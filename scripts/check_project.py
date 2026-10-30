#!/usr/bin/env python3
import json,sys
from pathlib import Path
base=Path(__file__).resolve().parents[1]
required=['index.html','style.css','main.js','.nojekyll','assets/scene-config.json','assets/annotations.json','blender-addon/lab5_splat_walkthrough_exporter.py']
errors=[name for name in required if not (base/name).is_file()]
try:
 c=json.loads((base/'assets/scene-config.json').read_text())
 for key in ('splat','depthMesh','collisionMesh'):
  entry=c.get(key)
  if not isinstance(entry,dict):errors.append(key+' object missing')
  elif entry.get('url','').startswith('./') and not (base/entry['url'][2:]).exists():errors.append(key+' asset file missing')
 n=json.loads((base/'assets/annotations.json').read_text())
 if not isinstance(n,list):errors.append('annotations not an array')
except Exception as exc:errors.append(str(exc))
if errors:
 print('FAIL:',*errors,sep='\n- ');sys.exit(1)
print('PASS: project structure and JSON validated')
