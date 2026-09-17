export type AuthUser = {
  id: string;
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
  user: AuthUser;
};

export type LogoutResponse = {
  message: string;
};
