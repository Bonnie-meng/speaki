"""Import the official CEFR-J 1.6 ZIP using only Python's standard library."""
import argparse, collections, datetime, hashlib, json, pathlib, posixpath, zipfile
import io, xml.etree.ElementTree as ET
parser=argparse.ArgumentParser();parser.add_argument('zip_path');parser.add_argument('--output',default='data/cefrj-a1-b2.json');args=parser.parse_args()
raw=pathlib.Path(args.zip_path).read_bytes();archive=zipfile.ZipFile(io.BytesIO(raw));xlsx=zipfile.ZipFile(io.BytesIO(archive.read('CEFR-J Wordlist Ver1.6.xlsx')))
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
strings=[''.join(node.itertext()) for node in ET.fromstring(xlsx.read('xl/sharedStrings.xml')).findall('m:si',ns)]
rels={node.attrib['Id']:node.attrib['Target'] for node in ET.fromstring(xlsx.read('xl/_rels/workbook.xml.rels'))}
book=ET.fromstring(xlsx.read('xl/workbook.xml'));sheet=next(s for s in book.findall('m:sheets/m:sheet',ns) if s.attrib['name']=='ALL')
target=rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']];sheet_path=posixpath.normpath('xl/'+target)
rows=[]
for node in ET.fromstring(xlsx.read(sheet_path)).findall('m:sheetData/m:row',ns):
 row={}
 for cell in node.findall('m:c',ns):
  value=cell.find('m:v',ns)
  if value is not None:row[''.join(c for c in cell.attrib['r'] if c.isalpha())]=strings[int(value.text)] if cell.attrib.get('t')=='s' else value.text
 rows.append(row)
assert rows[0]['A']=='headword'
entries=[]
for row in rows[1:]:
 headword=row.get('A','').strip();pos=row.get('B','').strip();level=row.get('C','').strip();assert headword and pos and level in ['A1','A2','B1','B2']
 variants=[s.strip() for s in headword.split('/') if s.strip()]
 key='\0'.join([headword,pos,level]);entry={'id':'cefrj16-'+hashlib.sha256(key.encode()).hexdigest()[:16],'word':variants[0],'pos':pos,'level':level}
 if len(variants)>1:entry['aliases']=variants[1:]
 topics=list(dict.fromkeys(row[k].strip() for k in ['D','E','F'] if row.get(k) and row[k].strip()))
 if topics:entry['topics']=topics
 entries.append(entry)
counts=dict(collections.Counter(e['level'] for e in entries));assert counts=={'A1':1166,'B1':2445,'A2':1411,'B2':2779},counts
assert len({e['id'] for e in entries})==7801
result={'source':{'name':'CEFR-J Wordlist','version':'1.6','published':'2020-03-24','retrievedAt':datetime.date.today().isoformat(),'url':'https://cefr-j.org/download.html','downloadUrl':'https://cefr-j.org/data/CEFRJ_wordlist_ver1.6.zip','sha256':hashlib.sha256(raw).hexdigest(),'attribution':'The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies.','rights':'Copyright Tono Laboratory, TUFS. Research and commercial use with appropriate attribution; see source terms. Not covered by the application MIT license.'},'levels':counts,'entries':entries}
path=pathlib.Path(args.output);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n');print(json.dumps({'entries':len(entries),'levels':counts,'bytes':path.stat().st_size}))
