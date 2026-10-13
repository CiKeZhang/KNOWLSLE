import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * 敏感数据加密工具(AES-256-GCM)
 * 用于加密学生考研成绩、目标院校等敏感字段,严格遵守高校学生信息保护规定。
 *
 * 加密格式: <iv>:<authTag>:<ciphertext>(均 base64)
 * 解密时需提供相同的 ENCRYPTION_KEY。
 */

const ALGO = 'aes-256-gcm';

function getKey(secret: string): Buffer {
  // 使用固定 salt 派生密钥(盐值与 secret 绑定,不单独存储)
  return scryptSync(secret, 'kygl-salt-v1', 32);
}

export class CryptoUtil {
  private static key: Buffer | null = null;

  static init(secret: string) {
    this.key = getKey(secret);
  }

  private static ensureKey(): Buffer {
    if (!this.key) {
      throw new Error('CryptoUtil 未初始化,请先调用 init(secret)');
    }
    return this.key;
  }

  /** 加密明文,返回 base64 编码的 iv:authTag:ciphertext */
  static encrypt(plaintext: string): string {
    if (!plaintext) return '';
    const key = this.ensureKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
  }

  /** 解密 iv:authTag:ciphertext,返回明文 */
  static decrypt(payload: string): string {
    if (!payload) return '';
    const parts = payload.split(':');
    if (parts.length !== 3) return '';
    const key = this.ensureKey();
    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /** 批量解密字段(用于查询结果脱敏后还原) */
  static decryptFields<T extends Record<string, any>>(obj: T, fields: string[]): T {
    const result = { ...obj };
    for (const f of fields) {
      if (result[f] && typeof result[f] === 'string') {
        try {
          result[f] = this.decrypt(result[f]);
        } catch {
          /* 解密失败保留原值(可能是未加密的历史数据) */
        }
      }
    }
    return result;
  }
}
