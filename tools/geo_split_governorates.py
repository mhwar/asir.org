import json,re,math
from shapely.geometry import shape,Point,Polygon,MultiPolygon,mapping
from shapely.ops import unary_union,voronoi_diagram
exec(open('/home/claude/geo2/centers.py').read())
n=lambda s:re.sub(r'[ًٌٍَُِّْـ]','',s).replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ة','ه').replace('ى','ي').replace(' ','').replace('ال','')
cities=[x for x in json.load(open('/tmp/sna/package/data/cities.full.json')) if x['region_id']==6]
idx={}
for x in cities:
  ce=x['center'];ce=json.loads(ce) if isinstance(ce,str) else ce
  idx.setdefault(n(x['name_ar']),[]).append((ce[1],ce[0]))
R=shape(json.load(open('/home/claude/geo2/asir_spl.json'))['geometry']).buffer(0)
P={f['properties']['ar']:shape(f['geometry']).buffer(0) for f in json.load(open('/home/claude/geo/asir_clean_in.geojson'))['features']}
EN={f['properties']['ar']:f['properties']['en'] for f in json.load(open('/home/claude/geo/asir_clean_in.geojson'))['features']}
NEW={'البرك':'Al Birk','الأمواه':'Al Amwah','الفرشة':'Al Farsha'}
seat={'أبها':'ابها','محايل عسير':'محايل'}
km=lambda a,b:math.hypot((a[0]-b[0])*105,(a[1]-b[1])*111)
S={};log=[]
for g,s in C.items():
  names=[t.strip() for t in re.split('[،,]',s)]
  # seat point
  cands=idx.get(n(seat.get(g,names[0])),[])
  if g in P: inn=[c for c in cands if P[g].contains(Point(c))]; sp=inn[0] if inn else (cands[0] if cands else None)
  else:
    sp=None
    if cands:
      # choose candidate closest to the other centers' candidates
      others=[c for nm in names[1:] for c in idx.get(n(nm),[])]
      sp=min(cands,key=lambda c:sum(sorted(km(c,o) for o in others)[:3]) if others else 0)
  pts=[]
  for nm in names:
    cs=idx.get(n(nm),[])
    if not cs: continue
    c=min(cs,key=lambda c:km(c,sp)) if sp else cs[0]
    if sp and km(c,sp)>120: log.append(('far',g,nm,round(km(c,sp)))); continue
    if g in P and not P[g].buffer(0.02).contains(Point(c)): log.append(('outside-own',g,nm)); continue
    pts.append(c)
  S[g]=pts;log.append((g,'seat',sp,len(pts)))
for l in log: print(l)
def vor_split(region,seeds):
  pts=[(Point(p),g) for g,ps in seeds.items() for p in ps]
  from shapely.geometry import MultiPoint
  vd=voronoi_diagram(MultiPoint([p for p,_ in pts]),envelope=region.envelope.buffer(1))
  out={}
  for cell in vd.geoms:
    for p,g in pts:
      if cell.contains(p):
        piece=cell.intersection(region)
        if not piece.is_empty: out.setdefault(g,[]).append(piece)
        break
  return {g:unary_union(v) for g,v in out.items()}
F={}
for g,poly in P.items():
  poly=poly.intersection(R)
  newin={k:[p for p in S[k] if poly.contains(Point(p))] for k in NEW}
  newin={k:v for k,v in newin.items() if v}
  if newin:
    seeds={g:S[g]};seeds.update(newin);print('split',g,{k:len(v) for k,v in seeds.items()})
    for k,v in vor_split(poly,seeds).items(): F.setdefault(k,[]).append(v)
  else: F.setdefault(g,[]).append(poly)
gap=R.difference(unary_union([unary_union(v) for v in F.values()]))
print('gap area',gap.area)
for k,v in vor_split(gap,S).items(): F.setdefault(k,[]).append(v)
F={k:unary_union(v).buffer(0) for k,v in F.items()}
# absorb tiny detached parts into the neighbour sharing the longest border
def parts(g): return list(g.geoms) if g.geom_type=='MultiPolygon' else [g]
for _ in range(4):
 for k in list(F):
  ps=sorted(parts(F[k]),key=lambda p:-p.area);keep=[ps[0]]
  for p in ps[1:]:
    best=max((o for o in F if o!=k),key=lambda o:F[o].buffer(1e-4).intersection(p.buffer(1e-4)).area)
    F[best]=unary_union([F[best],p.buffer(1e-7)]).buffer(0)
  F[k]=keep[0]
fc={'type':'FeatureCollection','features':[{'type':'Feature','properties':{'ar':k,'en':EN.get(k,NEW.get(k)),'derived':k in NEW or any(Point(p).within(F[k]) for nk in NEW for p in S[nk] if False)},'geometry':mapping(v)} for k,v in F.items()]}
json.dump(fc,open('asir19_raw.geojson','w'),ensure_ascii=False)
for k,v in sorted(F.items(),key=lambda x:-x[1].area): print(k,round(v.area*105*111),v.geom_type,len(parts(v)),'seat-in' if S[k] and v.contains(Point(S[k][0])) else '!!')
json.dump({k:v for k,v in S.items()},open('seeds.json','w'),ensure_ascii=False)
