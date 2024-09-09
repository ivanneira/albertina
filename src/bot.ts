import readline from 'readline';
import { LlamaCpp } from "@langchain/community/llms/llama_cpp";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { PromptTemplate } from "@langchain/core/prompts";
import { config } from './config.js';
import dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';
import Datastore from 'nedb';

dotenv.config(); 

// Inicialización del modelo
const model = new LlamaCpp({
    modelPath: config.modelPath,
    temperature: config.temperature,
    seed: config.seed,
    verbose: config.verbose,
});

const db = new Datastore({ filename: config.database, autoload: true });

async function getDataFromNeDB(): Promise<any> {
    return new Promise((resolve, reject) => {
        db.find({}, (err: any, docs: any) => {
            if (err) {
                reject(err);
            } else {
                resolve(docs);
            }
        });
    });
}

// Configuración de la interfaz de línea de comandos
const rl = readline.createInterface({
    input: process.stdin,
    //output: process.stdout
});

async function generateImageDescription(imagePath: string): Promise<string> {
    // Cargar el modelo de visión
    const model = new LlamaCpp({
        modelPath: config.vision_modelPath,
        temperature: 0.7,
        seed: -1,
        verbose: true,
    });

    // Leer el contenido de la imagen
    const imageData = fs.readFileSync(imagePath);

    // Formato del prompt para generar la descripción
    const prompt = `Describe en detalle la imagen proporcionada:

{image}

Response:
`;

    // Formatear el prompt con la imagen
    const promptTemplate = new PromptTemplate({
        template: prompt,
        inputVariables: ['image'],
    });
    const fullPrompt = await promptTemplate.format({ image: imageData.toString('base64') });

    // Generar la descripción usando el modelo
    let response = '';
    const stream = await model.stream([
        fullPrompt,
    ]);

    for await (const chunk of stream) {
        response += chunk;
        if (response.includes("<end_of_turn>")) {
            break;
        }
    }

    return response.replace("<end_of_turn>", '').trim();
}


// Función para generar la respuesta del modelo
async function generateModelResponse(prompt: string): Promise<string> {
    const template = "Human: {human_input}\n\nAssistant: Enseguida,";
    const promptTemplate = new PromptTemplate({ template, inputVariables: ["human_input"] });
    const fullPrompt = await promptTemplate.format({ human_input: prompt });

    let response = '';
    const stream = await model.stream([
        new SystemMessage(config.system),
        new HumanMessage(fullPrompt),
    ]);

    for await (const chunk of stream) {
        response += chunk;
        
        if (chunk.includes("<end_of_turn>")) {
            break;
        }
        process.stdout.write(chalk.blue(chunk));
    }
    
    return response.replace("<end_of_turn>", '').trim();
}

// Función para imprimir el banner de bienvenida
function printWelcomeBanner(): void {
    console.log(chalk.cyan(`
┌─────────────────────────────────────────────┐
│                                             │
│   🤖 Chat de Consola con IA                 │
│                                             │
└─────────────────────────────────────────────┘
    `));
    console.log(chalk.yellow("Escribe tu mensaje y presiona Enter. Para salir, escribe 'exit'.\n"));
}

// Función principal para manejar el chat
async function chatLoop(): Promise<void> {
    printWelcomeBanner();

    while (true) {
        const userInput = await new Promise<string>((resolve) => {
            process.stdout.write(chalk.green("\nTu : "));
            rl.question(chalk.green("Tú: "), resolve);
        });

        if (userInput.toLowerCase() === 'exit') {
            console.log(chalk.cyan("\n¡Hasta luego! 👋"));
            rl.close();
            break;
        }

        const regex = /^\/pic\s+(.*)/;
        const match = userInput.match(regex);

        if (match) {
            

            if(match[1]){
                const rutaArchivo = match[1];
                console.log(chalk.cyan("\nVeamos la imagen en " + rutaArchivo));
                await generateImageDescription(rutaArchivo);
            }
            

        }else{
            process.stdout.write(chalk.blue("\nIA : "));
            await generateModelResponse(userInput);
        }        
    }
}

// Iniciar el chat
chatLoop().catch(console.error);