import bcrypt from "bcryptjs";

export async function hashPassword(plain: string, rounds = 8): Promise<string> {
  const salt = await bcrypt.genSalt(rounds);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
