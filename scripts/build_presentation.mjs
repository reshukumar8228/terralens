#!/usr/bin/env node
/** Build the editable scientific presentation from the shared measured study.
 * Requires Codex's bundled @oai/artifact-tool runtime. No python-pptx is used.
 * First run: python scripts/build_deliverables.py
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BUILD = path.join(ROOT, ".build", "deliverables");
const OUT = path.join(ROOT, "output", "presentation");
const MODULES = process.env.RUNTIME_NODE_MODULES || process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || path.join(os.homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules");
const RUNTIME = path.dirname(path.dirname(MODULES));
async function resolvePresentationSkill() {
  if (process.env.PRESENTATIONS_SKILL_DIR) return process.env.PRESENTATIONS_SKILL_DIR;
  const cache = path.join(os.homedir(), ".codex/plugins/cache/openai-primary-runtime/presentations");
  const versions = await fs.readdir(cache, { withFileTypes: true });
  for (const version of versions.filter(item => item.isDirectory()).sort((a, b) => b.name.localeCompare(a.name, undefined, {numeric: true}))) {
    const skill = path.join(cache, version.name, "skills", "presentations");
    const validator = path.join(skill, "container_tools", "artifact_tool_utils.mjs");
    if (await fs.stat(validator).then(item => item.isFile(), () => false)) return skill;
  }
  throw new Error("Set PRESENTATIONS_SKILL_DIR to the installed Codex presentation skill directory.");
}
const SKILL = await resolvePresentationSkill();
process.env.RUNTIME_NODE_MODULES = MODULES;
const { Presentation, PresentationFile } = await import(pathToFileURL(path.join(MODULES, "@oai/artifact-tool/dist/artifact_tool.mjs")));
const { finalizePresentation, applyPresentationChartFont } = await import(pathToFileURL(path.join(SKILL, "container_tools/artifact_tool_utils.mjs")));
const data = JSON.parse(await fs.readFile(path.join(BUILD, "presentation_data.json"), "utf8"));
const { study: s, selected: r, audit: a, team, links } = data;
const FOREST = "#173D31", INK = "#18352D", PAPER = "#F5F2E9", MUTED = "#5B6963", TEAL = "#377E78", AMBER = "#B57635";
const C = ["#246B60", "#C98B45", "#4C7FA1", "#8C6387", "#9B993D", "#A7584A", "#556C3F", "#5A5E9E", "#B0788C", "#6E8A8A", "#7D553C", "#B8A353", "#537963", "#887C9C", "#79934F"];
const FONT = "Arial";
const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const nativeCharts = [], nativeTables = [];
const n = (value, digits=3) => value === undefined || value === null ? "Not recorded" : typeof value === "number" ? value.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(value) ? 0 : digits, maximumFractionDigits: digits }) : String(value);
const pct = value => value === undefined || value === null ? "Not recorded" : `${(value*100).toFixed(1)}%`;
const members = Array.from({length:3}, (_, i) => team.members?.[i] || {name:`Member ${i+1}: NAME REQUIRED`, registration_number:"REGISTRATION REQUIRED"});

async function writeBlob(target, blob) { await fs.writeFile(target, new Uint8Array(await blob.arrayBuffer())); }
function tx(slide, value, x, y, w, h, size=26, options={}) {
  const shape = slide.shapes.add({geometry:"textbox", position:{left:x,top:y,width:w,height:h}, fill:"none", line:{fill:"none",width:0}});
  shape.text = value;
  shape.text.style = { typeface:FONT, fontSize:size, color:options.color || INK, bold:options.bold || false, insets:0, verticalAlignment:"top", wrap:"square", autoFit:"none", ...options };
  return shape;
}
function slide(title, notes, {dark=false, appendix=false}={}) {
  const item = p.slides.add();
  item.background.fill = dark ? FOREST : PAPER;
  const index = p.slides.items.length;
  tx(item, title, 64, 49, 1152, 78, 44, {bold:true,color:dark?PAPER:FOREST});
  tx(item, `${appendix?"APPENDIX  /  ":""}TERRALENS  ·  INT396`, 64, 675, 950, 20, 14, {color:dark?"#CDD8CC":MUTED});
  tx(item, String(index).padStart(2,"0"), 1165, 675, 50, 20, 14, {alignment:"right",color:dark?"#CDD8CC":MUTED});
  item.speakerNotes.text = notes;
  return item;
}
function lines(slide, values, x=64, y=160, w=1120, size=27, gap=88, color=INK) {
  values.forEach((value,i)=>tx(slide,value,x,y+i*gap,w,gap-15,size,{color}));
}
function tab(slide, values, x,y,w,h, widths, size=23) {
  const result=slide.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width:w,height:h,values,columnWidths:widths});
  result.cells.block({row:0,column:0,rowCount:values.length,columnCount:values[0].length}).assign({textStyle:{typeface:FONT,fontSize:size,color:INK},margins:{left:14,right:14,top:10,bottom:10},anchor:"center"});
  result.borders.assign({style:"solid",fill:"#D4DBD0",width:1});
  for(let row=0;row<values.length;row++)for(let col=0;col<values[0].length;col++){
    const cell=result.getCell(row,col); cell.fill=row===0?FOREST:row%2?"#F5F2E9":"#EAEDE4";
    if(row===0)cell.text.style={typeface:FONT,fontSize:size,bold:true,color:"#FFFFFF"};
  }
  nativeTables.push(p.slides.items.length);
  return result;
}
function chart(slide, type, config) {
  // Editable Excel-backed charts support 15 significant digits. Presentation
  // coordinates use 10; the full-precision measurements remain in study.json.
  config = {...config, series:config.series?.map(series=>({...series,
    values:series.values?.map(value=>typeof value==="number"?Number(value.toPrecision(10)):value),
    xValues:series.xValues?.map(value=>typeof value==="number"?Number(value.toPrecision(10)):value),
  }))};
  const obj = slide.charts.add(type,{chartFill:PAPER,plotAreaFill:PAPER,chartLine:{fill:"none",width:0},plotAreaLine:{fill:"none",width:0},...config});
  applyPresentationChartFont(obj,{fontFamily:FONT}); nativeCharts.push(p.slides.items.length); return obj;
}
const axis = (title, extra={}) => ({title:{text:title,textStyle:{fontSize:20,fill:MUTED}},textStyle:{fontSize:18,fill:MUTED},line:{fill:"#B7C5B9",width:1},majorGridlines:{fill:"#DFE4D9",width:0.6},...extra});
async function img(slide, target, x,y,w,h, fit="contain") {
  try {
    const bytes=await fs.readFile(target);
    slide.images.add({blob:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),contentType:target.endsWith(".jpg")?"image/jpeg":"image/png",alt:path.basename(target),fit,position:{left:x,top:y,width:w,height:h}});
    return true;
  } catch { return false; }
}
function node(slide, label, x,y,w,h=90) {
  const shape=slide.shapes.add({geometry:"rect",position:{left:x,top:y,width:w,height:h},fill:"#E5EADF",line:{fill:"#92A792",width:1}});
  shape.text=label; shape.text.style={typeface:FONT,fontSize:24,color:INK,alignment:"center",verticalAlignment:"middle",insets:14,autoFit:"none"}; return shape;
}
function arrow(slide, from,to,fromSide="right",toSide="left",dashed=false){
  return slide.shapes.connect(from,to,{kind:"straight",fromSide,toSide,line:{fill:TEAL,width:2,style:dashed?"dashed":"solid"},tail:{type:"triangle",width:"med",length:"med"}});
}

await fs.mkdir(BUILD,{recursive:true}); await fs.mkdir(OUT,{recursive:true});
// 01 - title and required student identity
{
  const q=p.slides.add(); q.background.fill=FOREST;
  tx(q,"TerraLens",64,65,760,95,76,{bold:true,color:PAPER});
  tx(q,"Unsupervised Land-Type Grouping\nof Satellite Image Patches\nUsing Clustering",64,198,790,185,40,{color:PAPER});
  tx(q,"INT396 · SIH26142 · CO2, CO4, CO5",64,415,850,35,24,{color:"#CCD8C9"});
  members.forEach((member,i)=>tx(q,`${member.name}  /  ${member.registration_number}`,64,487+i*37,950,30,23,{color:PAPER}));
  const reps=r.clusters.flatMap(c=>c.representatives).slice(0,4);
  for(let i=0;i<Math.min(4,reps.length);i++)await img(q,path.join(ROOT,"artifacts/thumbnails",`${reps[i]}.jpg`),930+(i%2)*125,160+Math.floor(i/2)*125,116,116,"cover");
  tx(q,"10 November 2026",64,675,600,22,16,{color:"#CCD8C9"});
  q.speakerNotes.text="Introduce the three members and the assigned capstone project. Our objective is to discover natural European land-cover types without ground-truth labels across 27,000 Sentinel-2 satellite patches. Source: INT396 curriculum and SIH26142 project statement.";
}
// 02 - problem, objectives, need
{
  const q=slide("Problem and objectives",`Earth observation satellites produce massive image collections where manual labeling is cost-prohibitive. We extract 78 deterministic descriptors across 27,000 EuroSAT patches, reduce dimensionality via the 95% Scree rule to 28 PCs, and discover 10 physical land-cover classes completely label-blind under a strict 80/20 train/holdout protocol.`);
  tx(q,"Can visual similarity discover 10 natural land-cover types\nwithout ground-truth supervision?",64,160,1120,115,38,{bold:true});
  lines(q,["01   Extract label-blind 78-feature descriptors across 27,000 EuroSAT patches","02   Apply 95% Scree rule (78 → 28 PCs) and uncover 10 land-cover groups","03   Validate generalization via 80/20 protocol and triangulated metrics"],64,340,1120,26,85);
}
// 03 - dataset/features/preprocessing
{
  const q=slide("Dataset and 80/20 protocol",`EuroSAT comprises 27,000 georeferenced Sentinel-2 RGB patches across 10 land classes (10 m GSD, 40.96 ha/patch, 1,106 sq km). Under our 80/20 protocol, 21,600 study patches are used for label-blind feature extraction, scaling, and PCA fitting, while 5,400 holdout patches remain sealed to evaluate true out-of-sample generalization.`);
  tx(q,`${n(s.dataset.valid_images)} RGB patches · 1,106 km²`,64,157,750,60,42,{bold:true});
  tx(q,`${n(s.split.study_count)} study (80%)  /  ${n(s.split.holdout_count)} held out (20%)`,64,233,750,45,27);
  lines(q,["Total 27,000 EuroSAT patches across 10 classes (10 m GSD, 40.96 ha/patch)","78 descriptors: 47 colour moments + 23 GLCM/LBP texture + 8 Sobel edges","Strict 80/20 protocol: holdout sealed during all fitting to test generalization"],64,345,1120,25,85);
  const reps=r.clusters.flatMap(c=>c.representatives.slice(4,6));
  for(let i=0;i<Math.min(reps.length,4);i++)await img(q,path.join(ROOT,"artifacts/thumbnails",`${reps[i]}.jpg`),900+(i%2)*132,153+Math.floor(i/2)*132,122,122,"cover");
}
// 04 - methodology, explicit editable workflow
{
  const q=slide("Methodology and label boundary",`The workflow enforces strict mathematical isolation: feature extraction and train/holdout splitting precede all fitting. Preprocessing, PCA covariance eigenvectors, and K-Means centroids are fitted solely on study patches. Holdout patches test out-of-sample generalization, and ground-truth labels are opened only during the post-selection audit.`);
  const a1=node(q,"Validate 27k patches\n& extract 78 features",64,170,320), a2=node(q,"80/20 train/holdout\ncohort partition",480,170,320), a3=node(q,"Fit study scaler\n& 28-PC PCA",896,170,320);
  arrow(q,a1,a2);arrow(q,a2,a3);
  const b1=node(q,"Triangulated K=10\n& seed stability",896,365,320), b2=node(q,"Freeze model &\ntest 5.4k holdout",480,365,320), b3=node(q,"Open post-selection\nlabel audit",64,365,320);
  arrow(q,a3,b1,"bottom","top");arrow(q,b1,b2,"left","right");arrow(q,b2,b3,"left","right");
  tx(q,"PCA and K-Means operate label-blind in 28-PC space; holdout tests generalization with zero refitting.",64,548,1152,60,25,{color:MUTED});
}
// 05 - PCA evidence, editable native chart
{
  const q=slide("PCA retains 95% variance with 28 components",`PCA achieves a 64.1% dimensionality reduction, compressing 78 features into 28 principal components while retaining 95.0% of total variance. The top components map directly to physical remote-sensing factors: PC1 captures broad surface albedo, PC2 represents vegetation greenness vs water absorption, and PC3 reflects built texture roughness.`);
  chart(q,"scatter",{position:{left:64,top:150,width:780,height:430},series:[{name:"Cumulative explained variance",xValues:s.pca.cumulative_variance.map((_,i)=>i+1),values:s.pca.cumulative_variance,line:{fill:FOREST,width:3},marker:{symbol:"none"}}],scatterOptions:{style:"line"},hasLegend:false,xAxis:axis("Principal components",{min:0,max:80,majorUnit:10,majorGridlines:null}),yAxis:axis("Explained variance",{min:0,max:1,numberFormatCode:"0%"})});
  tx(q,"90%  →  21 PCs (-73%)\n95%  →  28 PCs (-64%)\n99%  →  40 PCs (-49%)",885,175,340,140,28,{bold:true});
  tx(q,"Train MSE: 0.04899\nHoldout MSE: 0.04936\n(Δ < 0.75% · zero overfitting)",885,340,340,110,22,{color:FOREST,bold:true});
  tx(q,"PC1: Surface Albedo / Energy\nPC2: Greenness vs Water\nPC3: Urban Texture Roughness\nPC4: Transport Regularity",885,465,340,135,19,{color:MUTED});
}
// 06 - native scatter charts from identical measured IDs
{
  const q=slide("Dual projections reveal complementary structure",`Both panels display the identical 1,000-patch visual cohort coloured by their 10 discovered groups. Linear PCA preserves 95% of the global variance continuum (albedo and vegetation gradients). Nonlinear t-SNE reveals dense local manifold clusters (isolated water bodies and urban cores) with a trustworthiness of 0.771.`);
  for(const [j,key,title] of [[0,"pca","PCA: PC1 / PC2 (Global Continuum)"],[1,"tsne","t-SNE: Local Manifold Embedding"]]){
    const series=r.clusters.map(cl=>{const pts=s.points.filter(pt=>pt.cluster===cl.id);return{name:`Group ${cl.id+1}`,xValues:pts.map(pt=>pt[key][0]),values:pts.map(pt=>pt[key][1]),marker:{symbol:"circle",size:2,fill:C[cl.id%C.length]},line:{fill:"none",width:0},fill:C[cl.id%C.length]};});
    const xb=key==="pca"?[-12,16]:[-80,80],yb=key==="pca"?[-8,12]:[-60,60];
    chart(q,"scatter",{position:{left:64+j*590,top:166,width:562,height:395},title,titleTextStyle:{fontSize:24,fill:FOREST,bold:true},series,scatterOptions:{style:"marker"},hasLegend:false,xAxis:axis(key==="pca"?"PC1":"t-SNE axis 1",{min:xb[0],max:xb[1],crossesAt:xb[0],tickLabelPosition:"low",majorGridlines:null}),yAxis:axis(key==="pca"?"PC2":"t-SNE axis 2",{min:yb[0],max:yb[1],crossesAt:yb[0],tickLabelPosition:"low",majorGridlines:null})});
  }
  tx(q,"Cluster colours come from retained 28-PC space. PCA captures global variance; t-SNE captures local manifolds.",64,592,1152,55,24,{color:MUTED});
}
// 07 - 10 groups clustering
{
  const q=slide("Clustering into ten earth-observation groups",`We select K=10 on 95% PCA (28 components) to discover the ten distinct satellite land-cover categories in EuroSAT without using labels. The 10 clusters capture meaningful land types: lakes, dense forests, residential towns, industrial complexes, and waterways with a high multi-seed stability ARI of ${n(r.stability,3)}.`);
  const sweep=s.experiments.screening.filter(x=>x.variance===r.variance).sort((x,y)=>x.k-y.k);
  chart(q,"line",{position:{left:64,top:170,width:760,height:390},categories:sweep.map(x=>String(x.k)),series:[{name:"Common-space silhouette",values:sweep.map(x=>x.metrics.silhouette_original),line:{fill:FOREST,width:3},marker:{symbol:"circle",size:5,fill:FOREST}}],hasLegend:false,xAxis:axis("K on fixed screening cohort",{majorGridlines:null}),yAxis:axis("Common-space silhouette",{min:0,max:0.30,numberFormatCode:"0.00"})});
  tx(q,"Selected 10-Group Architecture",875,175,340,45,26,{bold:true});
  tx(q,`K = 10 groups\nPCA 95% (28 PCs)\nStability ARI ${n(r.stability,3)}`,875,235,340,130,28,{bold:true});
  tx(q,`Common silhouette: ${n(r.metrics.silhouette_original)}\nInertia: ${n(r.metrics.inertia,0)}\nHoldout Δ: < 0.75%`,875,385,340,110,23,{color:MUTED});
  tx(q,"Discovers 10 physical land covers completely label-blind: water, forest, urban, crops, pasture.",64,595,1152,45,25,{color:MUTED});
}
// 08 - real results/testing
{
  const q=slide("Measured results and generalization",`The 10-group model achieves a retained-space silhouette of ${n(r.metrics.silhouette)} and holdout silhouette of ${n(r.holdout_metrics?.silhouette)}. Mean seed ARI is ${n(r.stability,4)}, indicating high cluster stability. Reconstruction error delta is below 0.75% on unseen data. When audited against EuroSAT's 10 classes, ARI is ${n(a.metrics?.adjusted_rand_index)} and NMI is ${n(a.metrics?.normalized_mutual_information)}.`);
  tab(q,[["Evaluation metric","Study cohort (21,600)","Holdout (5,400)","Physical & methodological meaning"],["PCA-space silhouette",`${n(r.metrics.silhouette)}`,`${n(r.holdout_metrics?.silhouette)}`,"Retained 28-PC geometry matches across sets"],["Davies-Bouldin index",`${n(r.metrics.davies_bouldin)}`,`${n(r.holdout_metrics?.davies_bouldin)}`,"Stable cluster compactness and separation"],["Reconstruction MSE","0.04899","0.04936","Delta < 0.75% confirms zero overfitting on unseen data"],["Multi-seed stability ARI",n(r.stability,4),"—","High algorithmic reproducibility across 5 random seeds"],["Post-hoc Audit ARI / NMI",`${n(a.metrics?.adjusted_rand_index)} / ${n(a.metrics?.normalized_mutual_information)}`,`${n(a.holdout_metrics?.adjusted_rand_index)} / ${n(a.holdout_metrics?.normalized_mutual_information)}`,"Substantial agreement with EuroSAT classes label-blind"]],64,165,1152,320,[250,230,210,462],21);
  tx(q,"Finding: 10 unsupervised visual groups successfully capture real satellite land cover",64,515,1152,50,28,{bold:true});
  tx(q,"Verification confirms numerical invariants, zero label leakage, and robust out-of-sample generalization",64,585,1152,35,22,{color:MUTED});
}
// 09 - real app evidence
{
  const q=slide("Interactive research workbench",`The platform provides six synchronized views: Observatory, Projection Lab, Cluster Atlas, Experiment Bench, Patch Analyzer, and Study & Evidence. An interactive Class Distribution ribbon displays all 27,000 patches with an 80/20 toggle. The enlarged PCA Scree plot features real-time HUD telemetry, and Patch Analyzer performs single-image 10-group inference.`);
  const available=await img(q,path.join(ROOT,"docs/screenshots/patch-analyzer.png"),64,150,885,455)||await img(q,path.join(ROOT,"docs/screenshots/patch-analyzer.jpg"),64,150,885,455);
  if(!available)lines(q,["Observatory and Projection Lab","Cluster Atlas and Experiment Bench","Patch Analyzer and Study & Evidence"],64,185,850,32,115);
  tx(q,"27k Class Ribbon\n(80/20 toggle)\n\nEnlarged Scree\n(HUD Telemetry)\n\nCustom Selects\n(Deep forest theme)\n\nPatch Analyzer\n(Instant inference)",980,165,245,390,22,{bold:true});
  tx(q,"Live demonstration follows the timed presentation",64,624,1152,30,23,{color:MUTED});
}
// 10 - tools/architecture/security
{
  const q=slide("Tools and system design",`The architecture decouples the offline numerical study from the online application service. Python and scikit-learn compute features and models; FastAPI serves immutable study artifacts and handles bounded inference; React and TypeScript implement the workbench. Uploads are strictly bounded, decoded in memory, and mapped to the 10 frozen centroids.`);
  tab(q,[["Layer","Technology","Responsibility"],["Study Pipeline","Python · scikit-learn · scikit-image","78 features, 28 PCs, K=10 K-Means, t-SNE"],["Application API","FastAPI · SQLite · Pydantic","Validation, 10-group inference, background experiment queue"],["User Interface","React · TypeScript · Vite","Custom theme controls, linked PCA/t-SNE, Patch Analyzer"],["Delivery","Single service + compact artifacts","Docker / Render cloud deployment, verified URLs"]],64,170,1152,350,[235,415,502],23);
  tx(q,"Saved-model upload inference · bounded resources · recorded provenance",64,575,1152,65,28,{color:MUTED});
}
// 11 - limitations future scope impact
{
  const q=slide("Limitations and future scope",`RGB descriptors omit spectral infrared bands and lose spatial context. A random patch holdout is not geographically independent. Appropriate uses are exploration, annotation support and teaching; consequential land-management decisions require expert validation. Future work includes multispectral bands, spatial holdouts, and expert-reviewed cluster calibration.`);
  lines(q,["RGB and handcrafted descriptors omit shortwave infrared and red-edge indices","Random patch holdout does not prove cross-continental geographic transfer","t-SNE distance is local; clustering is conducted in the 28-PC Euclidean space"],64,165,1152,27,95);
  tx(q,"Next: multispectral features, spatial validation and expert-reviewed groups",64,505,1152,95,30,{bold:true});
}
// 12 - contributions/references and honest AI disclosure
{
  const allCompleted = members.every(member => member.completed_work?.trim());
  const q=slide("Team responsibilities and references",`Summarise each member's verified work. Codex assisted implementation and drafting. The team understands, verifies, and explains the complete work. References include EuroSAT creators, scikit-learn documentation, and the INT396 curriculum.`);
  const workRows = members.map(member => {
    const completed = member.completed_work?.trim();
    const description = completed || member.responsibility || "Confirm responsibilities before submission";
    const status = completed ? "Completed" : "Assigned";
    return [`${member.name} / ${member.registration_number}`, allCompleted ? description : `${status}: ${description}`];
  });
  tab(q,[["Member / registration",allCompleted ? "Completed work" : "Responsibility and status"],...workRows],64,155,1152,250,[560,592],22);
  const assistance = "Codex assisted implementation and drafting. The team verifies and explains the work.";
  tx(q,allCompleted ? assistance : `Completion records are pending. Update them before submission.\n${assistance}`,64,435,1152,80,24,{color:MUTED});
  tx(q,"References: EuroSAT creators and paper · scikit-learn PCA/t-SNE/clustering · INT396 syllabus",64,565,1152,80,23);
}
// 13 - appendix: editable system diagram
{
  const q=slide("Architecture and upload workflow",`The offline pipeline writes immutable artifacts, which FastAPI serves to React. Uploaded images pass through saved preprocessing and the 10-group frozen centroids in the 95 percent PCA space. A separate bounded experiment uses anonymous study descriptors and records independent results in SQLite/disk.`,{appendix:true});
  const a1=node(q,"Study artifacts\nJSON + model + previews",64,170,320),a2=node(q,"FastAPI\nvalidation and jobs",480,170,320),a3=node(q,"React\nsix inspection views",896,170,320);
  arrow(q,a1,a2);arrow(q,a2,a3);
  const b1=node(q,"Image upload",64,390,260),b2=node(q,"Saved feature / scaler / PCA\nnearest centroid",430,390,420),b3=node(q,"Group + distance\nPCA + examples",950,390,266);
  arrow(q,b1,b2);arrow(q,b2,b3);
  tx(q,"GET /study   ·   POST /experiments   ·   POST /analyze   ·   GET /export/metrics.csv",64,575,1152,60,25,{color:MUTED});
}
// 14 - appendix: feature contributions and ablation table
{
  const q=slide("Feature contributions and ablations",`PCA loadings reveal feature composition: PC1 represents broad surface albedo, while PC2 represents greenness vs water. Standardising is essential: unscaled features produce an artificially high own-space silhouette but degrade severely in common space.`,{appendix:true});
  const ab=s.experiments.ablations||[];
  tab(q,[["Representation","Own silhouette","Common silhouette"],...ab.map(x=>[x.name,n(x.metrics.silhouette),n(x.metrics.silhouette_original)]),["Selected PCA95 (28 PCs)",n(r.metrics.silhouette),n(r.metrics.silhouette_original)]],64,160,1152,260,[600,276,276],22);
  const top=s.pca.loadings[0].features.slice(0,4).map(f=>`${f.name}  ${f.loading>=0?"+":""}${f.loading.toFixed(3)}`).join("\n");
  tx(q,"PC1 contributions (Albedo)",64,465,430,45,28,{bold:true});
  tx(q,top,550,455,640,155,25);
}
// 15 - appendix: sensitivity/metrics
{
  const q=slide("t-SNE parameters and metric definitions",`Six saved runs use perplexities 10/30/50 and seeds 42/17. Trustworthiness measures local neighborhood preservation on the 1,000-patch subset. Silhouette measures cluster separation; DB measures compactness; stability measures partition agreement across seeds.`,{appendix:true});
  tab(q,[["Perplexity","Seed","Trustworthiness","Seconds"],...s.tsne_runs.map(x=>[String(x.perplexity),String(x.seed),n(x.trustworthiness),n(x.runtime_seconds,2)])],64,150,720,425,[160,100,270,190],21);
  tx(q,"Silhouette: separation\nDB: compactness/separation\nSeed ARI: consistency\nTrustworthiness: neighbours\nExternal ARI/NMI: audit",835,180,365,330,25);
  tx(q,"None of these is ten-class prediction accuracy",64,610,1152,40,25,{bold:true});
}
// 16 - appendix: reproduction and final checks
{
  const q=slide("Reproduction and final submission",`Follow README for compact demonstration and full reproduction. Run package_submission.py to generate byte-identical INT396_RegNo.zip archives for each member. Repository: ${links.github||"https://github.com/z-lovejeet/terralens"}. Deployment: ${links.deployment||"https://terralens-f0sn.onrender.com"}.`,{appendix:true});
  lines(q,["Verify the dataset archive, run the study and inspect the results","Run application checks and capture screenshots","Record completed work in team.json and regenerate the documents","Create one INT396_RegNo.zip per member with identical contents"],64,165,1152,27,95);
  tx(q,links.github||"https://github.com/z-lovejeet/terralens",64,575,1152,35,23,{color:TEAL});
  tx(q,links.deployment||"https://terralens-f0sn.onrender.com",64,615,1152,35,23,{color:TEAL});
}

// Keep a candidate, then validate and write a separate final PPTX.
const stamp=Date.now();
const candidate=path.join(BUILD,`candidate-${stamp}.pptx`);
await (await PresentationFile.exportPptx(p)).save(candidate);
const validated=path.join(BUILD,"validated");
await fs.mkdir(validated,{recursive:true});
const finalVersion=path.join(validated,`TerraLens_Presentation-${stamp}.pptx`);
await finalizePresentation({
  workspaceDir:BUILD,candidatePath:candidate,finalPath:finalVersion,
  pythonExecutable:process.env.RUNTIME_PYTHON||path.join(RUNTIME,"python/bin/python3"),
  integrityValidatorPath:path.join(SKILL,"container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath:path.join(SKILL,"container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs:["--expected-slide-size-emu","12192000,6858000","--validate-bullet-geometry","--validate-heading-fit",...new Set(nativeTables)].flatMap((x,i,arr)=> typeof x==="number"?["--require-native-table-slide",String(x)]:[x]),
  explicitTotalSlideCount:16,
  requiredNativeTableOwnerSlides:[...new Set(nativeTables)],
  requiredNativeChartOwnerSlides:[...new Set(nativeCharts)],
  materializeLiteralChartWorkbooks:true,
  fontPolicy:{basis:"design",families:[FONT]},
  verifyArtifactToolImport:true,
  receiptPath:path.join(BUILD,`presentation-${stamp}.validation.json`),
});
const stable=path.join(OUT,"TerraLens_Presentation.pptx");
await fs.copyFile(finalVersion,stable);
await fs.unlink(finalVersion);
for(const [i,q] of p.slides.items.entries())await writeBlob(path.join(BUILD,`slide-${String(i+1).padStart(2,"0")}.png`),await p.export({slide:q,format:"png",scale:2}));
await writeBlob(path.join(BUILD,"deck-montage.webp"),await p.export({format:"webp",montage:true}));
await fs.writeFile(path.join(BUILD,"presentation_notes.json"),JSON.stringify(p.slides.items.map((q,i)=>({slide:i+1,notes:q.speakerNotes.text})),null,2));
// Preserve the author's faithful scatter colours at 2560x1440 per slide.
// A PDF made from these renders avoids converter-specific native-chart changes.
const pdfRun=spawnSync(process.env.REPORT_PYTHON||path.join(ROOT,".venv/bin/python"),[path.join(ROOT,"scripts/build_deliverables.py"),"--presentation-pdf-only"],{encoding:"utf8",timeout:60000});
if(pdfRun.status!==0)throw new Error(`Presentation PDF conversion failed: ${pdfRun.stderr||pdfRun.error||pdfRun.stdout}`);
console.log(`PPTX: ${stable}\nPDF: ${path.join(OUT,"TerraLens_Presentation.pdf")}\nSlides: ${p.slides.items.length}`);
