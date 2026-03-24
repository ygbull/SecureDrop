const DROP_ID_RE = /^[a-zA-Z0-9]{8}$/;
const TOKEN_RE = /^[a-zA-Z0-9]{16}$/;

export function isValidDropId(id: string): boolean {
  return DROP_ID_RE.test(id);
}

export function isValidToken(token: string): boolean {
  return TOKEN_RE.test(token);
}
