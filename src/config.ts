// config.ts
import dotenv from 'dotenv';

dotenv.config();

export const config = {
    telegramToken: process.env.TG_TOKEN || '',
    modelPath: "./models/"+process.env.MODEL,
    temperature: 0.1,
    seed: 1337,
    verbose: true,
    system: "Sé preciso, breve, y no des explicaciones adicionales a menos que las soliciten.",
};