import json
from shapely.geometry import shape,mapping,MultiPoint,Point
from shapely.ops import unary_union,voronoi_diagram
R=shape(json.load(open('/home/claude/geo2/asir_spl.json'))['geometry']).buffer(0)
GF=json.load(open('/home/claude/geo3/asir19_raw.geojson'))['features']
G={f['properties']['ar']:shape(f['geometry']).buffer(0).intersection(R) for f in GF}
# close any micro gap inside R by giving it to the governorate that shares most border
U=unary_union(list(G.values()));inner=R.difference(U)
for p in (inner.geoms if hasattr(inner,'geoms') else [inner]):
  if p.is_empty or p.area==0: continue
  k=max(G,key=lambda k:G[k].buffer(1e-5).intersection(p).area);G[k]=unary_union([G[k],p]).buffer(0)
NB={f['properties']['ar']:shape(f['geometry']).buffer(0).difference(R) for f in json.load(open('/home/claude/geo3/nb_raw.geojson'))['features'] if f['geometry']}
D=0.32
LAND=unary_union([shape(f['geometry']).buffer(0) for f in json.load(open('/home/claude/geo/adm1.geojson'))['features']]).buffer(0.04)
zone=R.buffer(D).difference(R).difference(unary_union(list(NB.values()))).intersection(LAND)
# keep only land reachable from neighbours: drop strip parts that face the sea next to Asir's coast
import shapely,numpy as np
Rm=max(R.geoms,key=lambda p:p.area) if R.geom_type=='MultiPolygon' else R
cs=np.array(Rm.exterior.simplify(0.002).segmentize(0.02).coords)
segs=shapely.linestrings(np.stack([cs[:-1],cs[1:]],axis=1))
d=np.min(np.stack([shapely.distance(segs,g.simplify(0.005)) for g in NB.values()]),axis=0)
Ls=LAND.buffer(-0.05).simplify(0.003);Rs=Rm.simplify(0.002)
bf=shapely.difference(shapely.buffer(segs,0.04),Rs);fr=shapely.area(shapely.intersection(bf,Ls))/np.maximum(shapely.area(bf),1e-12)
mx=shapely.get_coordinates(shapely.centroid(segs))[:,0]
COAST=unary_union(list(segs[(fr<0.5)&(mx<42.6)]))
zone=zone.difference(COAST.buffer(0.2));print('coast km',round(COAST.length*105))
# assign the empty strip to the nearest neighbour region (grid of 0.01 deg)
from shapely.geometry import box
from shapely.strtree import STRtree
import numpy as np
minx,miny,maxx,maxy=zone.bounds;st=0.01;add={k:[] for k in NB}
keys=list(NB);geoms=[NB[k] for k in keys]
zp=zone.buffer(0)
for x in np.arange(minx,maxx,st):
  for y in np.arange(miny,maxy,st):
    b=box(x,y,x+st,y+st)
    if not zp.intersects(b): continue
    c=b.centroid;d=[g.distance(c) for g in geoms];i=int(np.argmin(d))
    if d[i]<=D: add[keys[i]].append(b)
for k in NB:
  a=unary_union(add[k]).intersection(zp) if add[k] else None
  if a is not None: NB[k]=unary_union([NB[k],a]).buffer(1e-6).buffer(-1e-6).difference(R)
# report
ring=R.buffer(0.04).difference(R);cov=unary_union(list(NB.values()))
print('inner gap',R.difference(unary_union(list(G.values()))).area,'ring uncovered',round(ring.difference(cov).area,5),'of',round(ring.area,5))
fs=[{'type':'Feature','properties':{'ar':k,'kind':'gov'},'geometry':mapping(v)} for k,v in G.items()]+[{'type':'Feature','properties':{'ar':k,'kind':'nb'},'geometry':mapping(v)} for k,v in NB.items()]
json.dump({'type':'FeatureCollection','features':fs},open('all.geojson','w'),ensure_ascii=False)
