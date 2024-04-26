import dotenv from 'dotenv'

dotenv.config()

// eslint-disable-next-line node/prefer-global/process
export const proc = process

export const isDev = proc.env.MODE === 'development'
export const isProd = proc.env.MODE === 'production'
