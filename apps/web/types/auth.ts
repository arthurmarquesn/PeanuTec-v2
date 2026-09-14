export type AuthUser = {
  id?: string;
  name: string;
  email: string;
};

export type LoginRequest = {
  email: string;
  senha: string;
};

export type RegisterRequest = {
  nome: string;
  email: string;
  senha: string;
};

export type LoginResponse = {
  access_token: string;
  token_type?: string;
  user?: AuthUser;
};
