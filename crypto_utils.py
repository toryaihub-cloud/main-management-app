import os
import base64
import hashlib
from cryptography.fernet import Fernet

# 기본 암호화 키 생성 (환경변수 또는 기본 시크릿 기반)
SECRET_PASSPHRASE = os.getenv("APP_ENCRYPTION_SECRET", "AntigravitySecretKey_2026_Facilities_Mgmt!")
key_32bytes = hashlib.sha256(SECRET_PASSPHRASE.encode("utf-8")).digest()
fernet_key = base64.urlsafe_b64encode(key_32bytes)
cipher = Fernet(fernet_key)

def encrypt_data(plain_text: str) -> str:
    """
    민감 데이터(성명, 연락처, 주민/법인번호, 상세주소 등)를 AES-256 (Fernet)으로 암호화
    """
    if plain_text is None:
        return None
    plain_str = str(plain_text).strip()
    if not plain_str or plain_str.lower() == 'none' or plain_str == 'nan':
        return None
    encrypted_bytes = cipher.encrypt(plain_str.encode("utf-8"))
    return encrypted_bytes.decode("utf-8")

def decrypt_data(cipher_text: str) -> str:
    """
    암호화된 문자열을 복호화
    """
    if cipher_text is None:
        return None
    try:
        decrypted_bytes = cipher.decrypt(str(cipher_text).encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        print(f"Decryption error: {e}")
        return cipher_text

if __name__ == "__main__":
    test_val = "홍길동 (010-1234-5678)"
    enc = encrypt_data(test_val)
    dec = decrypt_data(enc)
    print("Original:", test_val)
    print("Encrypted:", enc)
    print("Decrypted:", dec)
    assert test_val == dec
