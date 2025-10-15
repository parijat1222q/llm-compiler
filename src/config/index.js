require('dotenv').config();
const Joi = require('joi');
const path = require('path');

const schema = Joi.object({
  PORT: Joi.number().default(3000),
  OPENAI_API_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.string().allow('').optional()
  }),
  OPENAI_MODEL: Joi.string().default('gpt-4'),
  OPENAI_FORCE_JSON_MODE: Joi.string().valid('true', 'false').default('true'),
  OUTPUT_DIR: Joi.string().default('./output'),
  NODE_ENV: Joi.string().valid('development', 'production').default('development')
}).unknown();

const { error, value: env } = schema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  port: Number(env.PORT),
  openai: {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    forceJsonMode: String(env.OPENAI_FORCE_JSON_MODE || 'true') === 'true'
  },
  outputDir: path.resolve(env.OUTPUT_DIR),
  nodeEnv: env.NODE_ENV
};

module.exports = config;
