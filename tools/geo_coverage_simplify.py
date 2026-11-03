import json,shapely,sys
from shapely.geometry import shape,mapping
from shapely.ops import unary_union,polygonize
from shapely.strtree import STRtree
tol=float(sys.argv[1])
F=json.load(open('all.geojson'))['features']
G=list(shapely.set_precision([shape(f['geometry']) for f in F],1e-6))
lines=unary_union([g.boundary for g in G])
faces=list(polygonize(lines))
tree=STRtree(G);parts=[[] for _ in G]
for fc in faces:
  p=fc.representative_point();hit=tree.query(p,predicate='within')
  if len(hit): parts[hit[0]].append(fc)
C=[unary_union(ps) for ps in parts]
# drop specks: absorb small detached parts / tiny faces into neighbour with longest shared edge
def pl(g): return list(g.geoms) if g.geom_type=='MultiPolygon' else [g]
print('coverage valid',shapely.coverage_is_valid(C),'faces',len(faces))
S=list(shapely.coverage_simplify(C,tol,simplify_boundary=True))
S=[unary_union([p for p in pl(g) if p.area>0.0003] or [max(pl(g),key=lambda p:p.area)]) for g in S]
json.dump({'type':'FeatureCollection','features':[{'type':'Feature','properties':f['properties'],'geometry':mapping(g)} for f,g in zip(F,S)]},open('simp.geojson','w'))
json.dump(mapping(unary_union([g for f,g in zip(F,S) if f['properties']['kind']=='gov'])),open('outline.geojson','w'))
print('vertices',sum(shapely.get_num_coordinates(g) for g in S),'valid after',shapely.coverage_is_valid(S))
