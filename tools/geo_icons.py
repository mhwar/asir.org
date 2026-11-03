import json,shapely
from shapely.geometry import shape
from shapely.ops import unary_union
F=[f for f in json.load(open('simp.geojson'))['features'] if f['properties']['kind']=='gov']
G=[shape(f['geometry']) for f in F]
S=list(shapely.coverage_simplify(G,0.012,simplify_boundary=True))   # finer: icons are zoomed in now
X=lambda lon:246.48*lon-10048.5; Y=lambda lat:5517.3-260.83*lat
def pl(g): return list(g.geoms) if g.geom_type=='MultiPolygon' else [g]
def path(g,mn=0.0005):
  out=[]
  for p in pl(g):
    if p.area<mn: continue
    c=list(p.exterior.coords)[:-1];out.append('M'+'L'.join(f'{X(x):.0f},{Y(y):.0f}' for x,y in c)+'Z')
  return ''.join(out)
g=json.load(open('/home/claude/geo/asir_geo.json'))
ico={'g':{},'b':{}}
for f,s in zip(F,S):
  k=f['properties']['ar'];ico['g'][k]=path(s);b=s.bounds
  ico['b'][k]=[round(X(b[0])),round(Y(b[3])),round(X(b[2])-X(b[0])),round(Y(b[1])-Y(b[3]))]
O=unary_union(S);ico['o']=path(O,0.003);b=O.bounds
ico['vb']=[round(X(b[0])),round(Y(b[3])),round(X(b[2])-X(b[0])),round(Y(b[1])-Y(b[3]))]
g['ico']=ico;json.dump(g,open('/home/claude/geo/asir_geo.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(json.dumps(ico,ensure_ascii=False)))
