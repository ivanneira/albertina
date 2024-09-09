// config.ts
import dotenv from 'dotenv';

dotenv.config();

export const config = {
    telegramToken: process.env.TG_TOKEN || '',
    modelPath: "./models/"+process.env.MODEL,
    vision_modelPath: "./models/"+process.env.VISION,
    temperature: 0.5,
    seed: 1337,
    verbose: false,
    system: "Sé preciso, breve, y no des explicaciones adicionales a menos que las soliciten.",
    database: process.env.DATABASE,
};