export type AuthPayload = {
  email: string;
  password: string;
};

export type AuthResult = {
  user: {
    id: string;
    email: string;
    role: string;
    displayName?: string;
    emailVerifiedAt?: string;
    emailVerificationSentAt?: string;
    passwordConfigured?: boolean;
    googleLinked?: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  verificationEmailSent?: boolean;
};

export type AdminUserCreateInput = {
  email: string;
  password: string;
  displayName?: string;
};

export type AdminUserStatusInput = {
  status: 'active' | 'disabled';
};

export type MeProfileUpdateInput = {
  displayName: string;
};

export type MePasswordUpdateInput = {
  currentPassword?: string;
  newPassword: string;
};

export type ForgotPasswordInput = {
  email: string;
};

export type ResetPasswordInput = {
  token: string;
  password: string;
};
