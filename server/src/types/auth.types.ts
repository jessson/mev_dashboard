import { z } from 'zod';

export const loginSchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 1 }
  },
  required: ['username', 'password']
};

export const loginZodSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空')
});

export type LoginRequest = z.infer<typeof loginZodSchema>;