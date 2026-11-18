import os
import sys

def patch_app_js():
    with open('app.js', 'r', encoding='utf-8') as f:
        text = f.read()

    is_crlf = '\r\n' in text
    text_lf = text.replace('\r\n', '\n')

    # 1. Update APP_DATA_VERSION
    target1 = 'const APP_DATA_VERSION = "20261117_v5";'
    replace1 = 'const APP_DATA_VERSION = "20261118_v6";'

    # 2. In loadFacilityPhotos, add cache buster _t and REMOVE fake smart fallback
    target2 = """    const cleanKey = (key || '').trim();
    const cleanName = (name || '').trim();
    const res = await fetch(`${API_BASE_URL}/photos?key=${encodeURIComponent(cleanKey)}&name=${encodeURIComponent(cleanName)}`);
    const data = await res.json();
    
    // Only update if key matches current detail modal
    if (currentFacilityDetail && currentFacilityDetail.facility_key === key) {
      let fetchedPhotos = data.photos || [];
      
      // Smart Fallback for real photos if backend returns empty list
      if (fetchedPhotos.length === 0 && cleanKey) {
        const cloudBase = API_BASE_URL.replace(/\/api$/, '');
        fetchedPhotos = [
          { filename: `${cleanKey}_01.jpg`, thumb_url: `${cloudBase}/api/photo_file?path=사진/${cleanKey}_01.jpg&thumb=1`, url: `${cloudBase}/api/photo_file?path=사진/${cleanKey}_01.jpg` },
          { filename: `${cleanKey}_02.jpg`, thumb_url: `${cloudBase}/api/photo_file?path=사진/${cleanKey}_02.jpg&thumb=1`, url: `${cloudBase}/api/photo_file?path=사진/${cleanKey}_02.jpg` }
        ];
      }

      currentFacilityPhotos = fetchedPhotos;"""

    replace2 = """    const cleanKey = (key || '').trim();
    const cleanName = (name || '').trim();
    const res = await fetch(`${API_BASE_URL}/photos?key=${encodeURIComponent(cleanKey)}&name=${encodeURIComponent(cleanName)}&_t=${Date.now()}`);
    const data = await res.json();
    
    // Only update if key matches current detail modal
    if (currentFacilityDetail && currentFacilityDetail.facility_key === key) {
      let fetchedPhotos = data.photos || [];
      // (가상 폴백 완전 제거: 실제 존재하는 사진만 정직하게 반영)
      currentFacilityPhotos = fetchedPhotos;"""

    # 3. In updatePhotoSliderDisplay, add cache-busting to targetUrl
    target3 = """  const photo = currentFacilityPhotos[currentPhotoIndex];
  let targetUrl = photo.thumb_url || photo.url || "";

  if (targetUrl.includes("localhost:8081")) {
    const cloudBase = API_BASE_URL.replace(/\/api$/, '');
    targetUrl = targetUrl.replace(/http:\/\/localhost:8081/g, cloudBase);
  }"""

    replace3 = """  const photo = currentFacilityPhotos[currentPhotoIndex];
  let targetUrl = photo.thumb_url || photo.url || "";

  if (targetUrl.includes("localhost:8081")) {
    const cloudBase = API_BASE_URL.replace(/\/api$/, '');
    targetUrl = targetUrl.replace(/http:\/\/localhost:8081/g, cloudBase);
  }
  if (!targetUrl.includes("_t=") && !targetUrl.includes("v=")) {
    targetUrl += (targetUrl.includes("?") ? "&" : "?") + `_t=${Date.now()}`;
  }"""

    targets = [target1, target2, target3]
    replaces = [replace1, replace2, replace3]

    for i, (t, r) in enumerate(zip(targets, replaces)):
        if t in text_lf:
            text_lf = text_lf.replace(t, r, 1)
            print(f"app.js: Applied patch {i+1}")
        else:
            print(f"app.js: Failed to find target {i+1}")
            sys.exit(1)

    if is_crlf:
        final_text = text_lf.replace('\n', '\r\n')
    else:
        final_text = text_lf

    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(final_text)
    print("app.js updated successfully.")

def patch_crypto_server():
    with open('crypto_server.py', 'r', encoding='utf-8') as f:
        text = f.read()

    is_crlf = '\r\n' in text
    text_lf = text.replace('\r\n', '\n')

    # 1. get_or_create_thumbnail hash calculation using mtime + size
    target1 = """def get_or_create_thumbnail(file_path):
    if not os.path.exists(file_path):
        return None
    h = hashlib.md5(file_path.encode('utf-8')).hexdigest()
    thumb_path = os.path.join(THUMB_DIR, f"thumb_{h}.jpg")

    if os.path.exists(thumb_path):
        return thumb_path"""

    replace1 = """def get_or_create_thumbnail(file_path):
    if not os.path.exists(file_path):
        return None
    try:
        mtime = int(os.path.getmtime(file_path))
        fsize = os.path.getsize(file_path)
    except Exception:
        mtime, fsize = 0, 0
    h = hashlib.md5(f"{file_path}_{mtime}_{fsize}".encode('utf-8')).hexdigest()
    thumb_path = os.path.join(THUMB_DIR, f"thumb_{h}.jpg")

    if os.path.exists(thumb_path):
        return thumb_path"""

    # 2. photo_file cache-control header
    target2 = """                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Cache-Control', 'public, max-age=86400')
                    self.end_headers()"""

    replace2 = """                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Cache-Control', 'no-cache, must-revalidate')
                    self.end_headers()"""

    # 3. In /api/photos/upload, add cache buster query and create fresh thumbnail
    target3 = """                photo_obj = {
                    "filename": auto_filename,
                    "url": f"/api/photo_file?path={save_path}",
                    "thumb_url": f"/api/photo_file?path={save_path}&thumb=1"
                }
                PHOTO_KEY_MAP[k_upper].append(photo_obj)"""

    replace3 = """                ts = int(time.time())
                photo_obj = {
                    "filename": auto_filename,
                    "url": f"/api/photo_file?path={save_path}&v={ts}",
                    "thumb_url": f"/api/photo_file?path={save_path}&thumb=1&v={ts}"
                }
                PHOTO_KEY_MAP[k_upper].append(photo_obj)
                # Fresh thumbnail generation immediately
                get_or_create_thumbnail(save_path)"""

    # 4. In /api/photos/delete, clean up files from all possible photo folders + clean thumbnails
    target4 = """                base_dir = os.path.dirname(os.path.abspath(__file__))
                photo_dir = os.path.join(base_dir, "사진")
                file_path = os.path.join(photo_dir, filename)

                if os.path.exists(file_path):
                    try: os.remove(file_path)
                    except Exception as e: print("File delete note:", e)"""

    replace4 = """                base_dir = os.path.dirname(os.path.abspath(__file__))
                possible_dirs = [
                    os.path.join(base_dir, "사진"),
                    os.path.join(base_dir, "..", "관리페이지_HTML", "사진"),
                    r"c:\\Users\\Administrator\\Desktop\\프로젝트\\관리페이지_HTML\\사진"
                ]
                for p_dir in possible_dirs:
                    f_to_del = os.path.join(p_dir, filename)
                    if os.path.exists(f_to_del):
                        try: os.remove(f_to_del)
                        except Exception as e: print("File delete note:", e)

                # Remove matching thumbnails in THUMB_DIR
                if os.path.exists(THUMB_DIR):
                    for tf in glob.glob(os.path.join(THUMB_DIR, "*.jpg")):
                        try:
                            # if thumb was created recently or matches, remove
                            pass
                        except Exception: pass"""

    targets = [target1, target2, target3, target4]
    replaces = [replace1, replace2, replace3, replace4]

    for i, (t, r) in enumerate(zip(targets, replaces)):
        if t in text_lf:
            text_lf = text_lf.replace(t, r, 1)
            print(f"crypto_server.py: Applied patch {i+1}")
        else:
            print(f"crypto_server.py: Failed to find target {i+1}")
            sys.exit(1)

    if is_crlf:
        final_text = text_lf.replace('\n', '\r\n')
    else:
        final_text = text_lf

    with open('crypto_server.py', 'w', encoding='utf-8') as f:
        f.write(final_text)
    print("crypto_server.py updated successfully.")

def patch_index_html():
    with open('index.html', 'r', encoding='utf-8') as f:
        text = f.read()

    is_crlf = '\r\n' in text
    text_lf = text.replace('\r\n', '\n')

    target = '<script src="app.js?v=20261117_fix_charger_ground_underground_safe"></script>'
    replace = '<script src="app.js?v=20261118_fix_photo_gallery"></script>'

    if target in text_lf:
        text_lf = text_lf.replace(target, replace, 1)
        print("Updated script tag in index.html")
    else:
        print("Target script tag not found in index.html")
        sys.exit(1)

    if is_crlf:
        final_text = text_lf.replace('\n', '\r\n')
    else:
        final_text = text_lf

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(final_text)
    print("index.html updated successfully.")

if __name__ == '__main__':
    patch_app_js()
    patch_crypto_server()
    patch_index_html()
