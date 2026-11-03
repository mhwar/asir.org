import json
from shapely.geometry import shape
from shapely.ops import unary_union
X=lambda lon:246.48*lon-10048.5; Y=lambda lat:5517.3-260.83*lat
def path(g):
  out=[]
  for p in (g.geoms if g.geom_type=='MultiPolygon' else [g]):
    for ring in [p.exterior,*p.interiors]:
      c=list(ring.coords);out.append('M'+'L'.join(f'{X(x):.1f},{Y(y):.1f}' for x,y in c[:-1])+'Z')
  return ''.join(out)
old=json.load(open('/home/claude/geo/asir_geo.json'))
OG={g['ar']:g for g in old['govs']};ON={n['ar']:n for n in old['nb']}
F=json.load(open('simp.geojson'))['features']
govs=[];nb=[]
for f in F:
  k=f['properties']['ar'];g=shape(f['geometry'])
  if f['properties']['kind']=='gov':o=dict(OG[k]);o['d']=path(g);govs.append(o)
  else:o=dict(ON.get(k,{'ar':k,'lx':0,'ly':0}));o['d']=path(g);nb.append(o)
govs.sort(key=lambda g:[x['ar'] for x in old['govs']].index(g['ar']))
_o=json.load(open('outline.geojson'));ol=shape(_o['features'][0]['geometry'] if 'features' in _o else _o['geometries'][0] if 'geometries' in _o else _o)
new=dict(old);new.update(govs=govs,nb=nb,outline=path(ol))
json.dump(new,open('/home/claude/geo/asir_geo.json','w'),ensure_ascii=False,separators=(',',':'))
# verify on simplified geometry
G=unary_union([shape(f['geometry']) for f in F if f['properties']['kind']=='gov']);N=unary_union([shape(f['geometry']) for f in F if f['properties']['kind']=='nb'])
print('gov overlaps/holes vs outline:',round(ol.symmetric_difference(G).area,8),'gov∩nb',round(G.intersection(N).area,8))
print('size old',len(json.dumps(old,ensure_ascii=False)),'new',len(json.dumps(new,ensure_ascii=False)))
