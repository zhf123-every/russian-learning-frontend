# -*- coding: utf-8 -*-
import urllib.request, hashlib, sys
io_path = r'C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\_check_remote2.txt'
lines = []
url = 'https://russian-learning-frontend.pages.dev/assets/index-CtE5fw2K.js'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'identity'})
try:
    data = urllib.request.urlopen(req, timeout=60).read()
    lines.append('remote_bytes=' + str(len(data)))
    lines.append('remote_sha256=' + hashlib.sha256(data).hexdigest()[:16])
    txt = data.decode('utf-8', errors='replace')
    lines.append('remote_has_newblock=' + str('本次未保存' in txt))
    lines.append('remote_has_oldflash=' + str('本次用占位图保存' in txt))
    lines.append('remote_has_picsum=' + str('picsum.photos/seed/course_' in txt))
except Exception as e:
    lines.append('remote_error=' + repr(e))
local = open(r'C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\dist\assets\index-CtE5fw2K.js', 'rb').read()
lines.append('local_bytes=' + str(len(local)))
lines.append('local_sha256=' + hashlib.sha256(local).hexdigest()[:16])
lt = local.decode('utf-8', errors='replace')
lines.append('local_has_newblock=' + str('本次未保存' in lt))
with open(io_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print('done')
