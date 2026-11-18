with open('crypto_server.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'path == "/api/photo_file"' in l:
        for j in range(i, min(i+100, len(lines))):
            print(f'{j+1}: {lines[j]}', end='')
        break
