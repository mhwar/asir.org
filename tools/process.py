import openpyxl, collections, re, json, datetime, sys
wb=openpyxl.load_workbook('/home/claude/in2/db.xlsx',data_only=True); ws=wb.active
hdr=[c.value for c in ws[2]]
rows=[list(r) for r in ws.iter_rows(min_row=3,values_only=True) if r[0]]
TODAY=datetime.datetime(2026,11,2)
def gov(c):
  c=re.sub(r'\s+',' ',str(c).replace('ـ','')).strip()
  c=re.sub(r'^(مدينة|محافظة)\s*','',c)
  return {'محايل':'محايل عسير'}.get(c,c)
GROUPS=[('الأولى','الثقافة والترفيه','star'),('الثانية','التعليم والأبحاث','book'),('الثالثة','الصحة','heart'),('الرابعة','الخدمات الاجتماعية','people'),('الخامسة','البيئة','leaf'),('السادسة','التنمية والإسكان','building'),('السابعة','التأييد والمؤازرة','scale'),('الثامنة','دعم العمل الخيري','hand'),('التاسعة','الدعوة والإرشاد','book'),('العاشرة','الروابط المهنية','award')]
def grp(s):
  for k,n,i in GROUPS:
    if 'المجموعة '+k in s: return n
  return 'أخرى'
def clean(v): return re.sub(r'\s+',' ',str(v)).strip() if v not in (None,'') else ''
# dedupe by unified number (keep most recent license issue)
by={}
dups=[]
for r in rows:
  k=str(r[5]).strip()
  if k in by:
    dups.append(k)
    if (r[2] or TODAY)>(by[k][2] or TODAY): by[k]=r
  else: by[k]=r
recs=list(by.values())
print('rows',len(rows),'unique',len(recs),'dups',len(dups))
def is_test(e): return bool(e) and 'test.com' in str(e).lower()
pub=[];internal=[]
for i,r in enumerate(sorted(recs,key=lambda r:clean(r[0]))):
  exp=r[3]
  days=(exp-TODAY).days if isinstance(exp,datetime.datetime) else None
  status_calc='منتهي' if days is not None and days<0 else ('ينتهي خلال 90 يوماً' if days is not None and days<=90 else 'ساري')
  g=gov(r[8])
  pub.append({'id':i+1,'n':clean(r[0]),'lic':clean(r[1]),'y':r[6].year if isinstance(r[6],datetime.datetime) else None,'sup':clean(r[7]),'gov':g,'grp':grp(clean(r[11])),'s1':clean(r[12]),'s2':clean(r[13])})
  issues=[]
  for col,lab in ((14,'بريد الجمعية'),(17,'بريد المفوض'),(19,'بريد الرئيس')):
    if is_test(r[col]): issues.append(f'{lab}: عنوان تجريبي (test.com)')
  if not r[14]: issues.append('بريد الجمعية مفقود')
  if not r[15]: issues.append('جوال الجمعية مفقود')
  if clean(r[4])=='مفعل' and days is not None and days<0: issues.append('الحالة "مفعل" رغم انتهاء تاريخ الترخيص')
  internal.append([i+1,clean(r[0]),clean(r[1]),str(r[5]).strip(),g,grp(clean(r[11])),clean(r[12]),clean(r[13]),clean(r[7]),
    r[6].date() if isinstance(r[6],datetime.datetime) else r[6], r[2].date() if isinstance(r[2],datetime.datetime) else r[2], exp.date() if isinstance(exp,datetime.datetime) else exp, days, clean(r[4]), status_calc,
    '' if is_test(r[14]) else clean(r[14]), clean(r[15]), clean(r[16]), '' if is_test(r[17]) else clean(r[17]), clean(r[18]), '' if is_test(r[19]) else clean(r[19]),'لا', '؛ '.join(issues)])
json.dump(pub,open('/home/claude/work/public.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump({'internal':internal,'dups':dups},open('/home/claude/work/internal.json','w'),ensure_ascii=False,default=str)
c=collections.Counter(p['gov'] for p in pub); print(c)
print(collections.Counter(p['grp'] for p in pub))
print(collections.Counter(x[14] for x in internal), sum(1 for x in internal if x[22]))
# leak check: no email/phone/id in public
s=json.dumps(pub,ensure_ascii=False)
assert '@' not in s and '+966' not in s and not re.search(r'\b70\d{8}\b',s)
print('public size',len(s)//1024,'KB')
