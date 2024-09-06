import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { LlamaCpp } from "@langchain/community/llms/llama_cpp";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { PromptTemplate } from "@langchain/core/prompts";
import dotenv from 'dotenv';
import { config } from './config.js';

dotenv.config();

type WhitelistType = string | undefined;

function getWhitelist(whitelistEnv: WhitelistType): string[] {
  const whitelist = whitelistEnv?.split(',');
  if (!whitelist || whitelist.length === 0) {
    console.error('Whitelist is not defined or empty');
    return []; 
  }
  return whitelist;
}

const whitelist = getWhitelist(process.env.WHITELIST);

type BotContext = Context & {
    from?: {
        id: number;
    };
};

// Bot initialization
const bot = new Telegraf<BotContext>(config.telegramToken, { handlerTimeout: 1_000_000 });

// Model configuration
const model = new LlamaCpp({
    modelPath: config.modelPath,
    temperature: config.temperature,
    seed: config.seed,
    verbose: config.verbose,
});

async function streamModelResponse(prompt: string, ctx: BotContext): Promise<void> {
    try {
  
        let accumulatedResponse = '';
        const sentMessage = await ctx.reply('[...]');

        const template = "Human: {human_input}\n\nAssistant: Enseguida,";

        const promptTemplate = new PromptTemplate({ template, inputVariables: ["human_input"] });

        const fullPrompt = await promptTemplate.format({ human_input: prompt });

        const stream = await model.stream([
            new SystemMessage(config.system),
            new HumanMessage(fullPrompt),
        ]);

        for await (const chunk of stream) {
            accumulatedResponse += chunk;
            if (accumulatedResponse.includes("<end_of_turn>")) {
                break;
            }
            if (accumulatedResponse.length > 50 && /\./.test(chunk)) {
                await ctx.telegram.editMessageText(
                    ctx.chat!.id, 
                    sentMessage.message_id, 
                    undefined, 
                    `${accumulatedResponse} [ ⏳... ]`
                );
            }
        }

        const finalResponse = accumulatedResponse.replace("<end_of_turn>", '');

        console.log("[ASSISTANT]:", finalResponse);
        await ctx.telegram.editMessageText(
            ctx.chat!.id, 
            sentMessage.message_id, 
            undefined, 
            `${finalResponse} ✅`
        );

    } catch (error) {
        console.error('Error del modelo:', error);
        await ctx.reply('Hubo un error al procesar tu solicitud.');
    }
}

bot.on(message('text'), async (ctx) => {
    if (whitelist?.includes( ctx.from.id.toString() )) {
        const userMessage = ctx.message.text;
        console.log("[USER]: " + userMessage);
        await streamModelResponse(userMessage, ctx);
    } else {
        console.log("[!] Chat no autorizado, dump:");
        console.log(ctx);
        console.log(ctx.from);
    }
});

// Bot launch
bot.launch().then(() => {
    console.log('Bot de Telegram iniciado.');
}).catch((error) => {
    console.error('Error al iniciar el bot:', error);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));