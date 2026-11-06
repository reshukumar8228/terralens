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
  q.speakerNotes.text="15 seconds. Introduce the three members and the assigned title. Our question is whether interpretable visual features form natural groups when labels are hidden. Do not call this a validated land classifier. Source: teacher-provided project statement, SIH26142 metadata; INT396 syllabus.";
}
// 02 - problem, objectives, need
{
  const q=slide("Problem and objectives",`20 seconds. Satellite image collections are difficult to browse manually. We prepare EuroSAT with category labels hidden, compare PCA and t-SNE, and cluster in retained PCA space. We then document parameter effects and responsible interpretation. The course syllabus explicitly includes a PCA-versus-t-SNE dashboard. Source: INT396 syllabus, pp1-2 and teacher statement.`);
  tx(q,"Can visual similarity reveal useful structure\nwithout reference land-cover labels?",64,160,1120,115,39,{bold:true});
  lines(q,["01   Prepare anonymous patches and interpretable descriptors","02   Compare PCA and t-SNE; apply K-Means in PCA space","03   Evaluate sensitivity, explain groups and state limitations"],64,340,1120,27,85);
}
// 03 - dataset/features/preprocessing
{
  const q=slide("Dataset and preprocessing",`25 seconds. Actual reference: ${s.dataset.valid_images} valid RGB patches, ${s.split.study_count} study and ${s.split.holdout_count} holdout rows. Feature extraction uses 47 colour,23 texture,8 edge descriptors. No unreadable, duplicate or missing entries were found in this artifact. The defensive median imputer and scaler are fitted only on study rows. No categorical predictors are used. Labels are separate. Source: artifacts/study.json; EuroSAT creators https://github.com/phelber/EuroSAT and https://zenodo.org/records/7711810.`);
  tx(q,`${n(s.dataset.valid_images)} RGB patches`,64,157,700,60,43,{bold:true});
  tx(q,`${n(s.split.study_count)} study  /  ${n(s.split.holdout_count)} held out`,64,233,750,45,28);
  lines(q,["78 descriptors: 47 colour + 23 texture + 8 edges","Anonymous IDs; category labels stay outside fitting","Study-fitted scaling; zero missing values in this run"],64,345,1120,26,85);
  const reps=r.clusters.flatMap(c=>c.representatives.slice(4,6));
  for(let i=0;i<Math.min(reps.length,4);i++)await img(q,path.join(ROOT,"artifacts/thumbnails",`${reps[i]}.jpg`),900+(i%2)*132,153+Math.floor(i/2)*132,122,122,"cover");
}
// 04 - methodology, explicit editable workflow
{
  const q=slide("Methodology and label boundary",`25 seconds. Trace the top row and then the lower row. The study split precedes fitting. PCA and K-Means comparisons use study rows. After selecting the reference using internal evidence and seed stability, freeze it, transform heldout rows, and only then open reference labels for the audit. t-SNE is a separate saved visualisation of a fixed cohort. The diagram is editable. Sources: scripts/prepare_study.py, artifacts/study.json.`);
  const a1=node(q,"Validate images\nand extract features",64,170,320), a2=node(q,"Split study\nand holdout",480,170,320), a3=node(q,"Fit study scaler\nand PCA",896,170,320);
  arrow(q,a1,a2);arrow(q,a2,a3);
  const b1=node(q,"Compare K / variance\nand seed stability",896,365,320), b2=node(q,"Freeze reference\nand test holdout",480,365,320), b3=node(q,"Open separate\nlabel audit",64,365,320);
  arrow(q,a3,b1,"bottom","top");arrow(q,b1,b2,"left","right");arrow(q,b2,b3,"left","right");
  tx(q,"t-SNE: same visual cohort, recorded parameter comparisons, no clustering in its 2D coordinates",64,548,1152,60,26,{color:MUTED});
}
// 05 - PCA evidence, editable native chart
{
  const q=slide("PCA retains variance with fewer dimensions",`25 seconds. The targets need 21,28,40 components for 90%,95%,99% variance. Selected reference uses 28. The curve concerns variance in standardised descriptors, not accuracy. PC1 and PC2 on the plot retain only ${(100*s.pca.cumulative_variance[1]).toFixed(1)}% together, so they are a partial view of the clustering space. Source: artifacts/study.json; PCA API https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html.`);
  chart(q,"scatter",{position:{left:64,top:150,width:780,height:430},series:[{name:"Cumulative explained variance",xValues:s.pca.cumulative_variance.map((_,i)=>i+1),values:s.pca.cumulative_variance,line:{fill:FOREST,width:3},marker:{symbol:"none"}}],scatterOptions:{style:"line"},hasLegend:false,xAxis:axis("Principal components",{min:0,max:80,majorUnit:10,majorGridlines:null}),yAxis:axis("Explained variance",{min:0,max:1,numberFormatCode:"0%"})});
  tx(q,"90%  →  21 PCs\n95%  →  28 PCs\n99%  →  40 PCs",900,200,300,220,34,{bold:true});
  tx(q,"Retained variance\nis not accuracy",900,460,300,90,26,{color:MUTED});
}
// 06 - native scatter charts from identical measured IDs
{
  const q=slide("PCA and t-SNE show the same patches",`25 seconds. Each panel contains the same ${s.points.length} anonymous IDs coloured with reference K-Means groups. PCA2 trustworthiness is ${n(s.pca.pca2_trustworthiness)}; saved t-SNE trustworthiness varies with perplexity and seed. All trustworthiness comparisons use the recorded 1000-patch subset and ten neighbours in the full standardised descriptor reference space. Do not interpret t-SNE island gaps or areas as physical distances or class evidence. Sources: artifacts/study.json; TSNE API https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html.`);
  for(const [j,key,title] of [[0,"pca","PCA: PC1 / PC2"],[1,"tsne","t-SNE: saved reference view"]]){
    const series=r.clusters.map(cl=>{const pts=s.points.filter(pt=>pt.cluster===cl.id);return{name:`Group ${cl.id+1}`,xValues:pts.map(pt=>pt[key][0]),values:pts.map(pt=>pt[key][1]),marker:{symbol:"circle",size:2,fill:C[cl.id%C.length]},line:{fill:"none",width:0},fill:C[cl.id%C.length]};});
    const xb=key==="pca"?[-12,16]:[-80,80],yb=key==="pca"?[-8,12]:[-60,60];
    chart(q,"scatter",{position:{left:64+j*590,top:166,width:562,height:395},title,titleTextStyle:{fontSize:25,fill:FOREST,bold:true},series,scatterOptions:{style:"marker"},hasLegend:false,xAxis:axis(key==="pca"?"PC1":"t-SNE axis 1",{min:xb[0],max:xb[1],crossesAt:xb[0],tickLabelPosition:"low",majorGridlines:null}),yAxis:axis(key==="pca"?"PC2":"t-SNE axis 2",{min:yb[0],max:yb[1],crossesAt:yb[0],tickLabelPosition:"low",majorGridlines:null})});
  }
  tx(q,"Cluster colours come from retained PCA space. t-SNE has no explained-variance percentage.",64,592,1152,55,25,{color:MUTED});
}
// 07 - K comparison
{
  const q=slide("K selection favours a broad visual split",`30 seconds. Screening compares K2 through15 on the fixed 5000-patch cohort. It promotes candidates, then evaluates variance settings on the identical1500-patch metric sample. The frozen choice is K2/PCA95 with high seed stability. K10 is a contrast, not a supervised target. The K2 broad brightness/texture split has stronger common-space silhouette than K10, but that does not recover the ten annotated land classes. Sources: artifacts/study.json and separate audit.json. No labels were loaded for selection.`);
  const sweep=s.experiments.screening.filter(x=>x.variance===r.variance).sort((x,y)=>x.k-y.k);
  chart(q,"line",{position:{left:64,top:170,width:760,height:390},categories:sweep.map(x=>String(x.k)),series:[{name:"Common-space silhouette",values:sweep.map(x=>x.metrics.silhouette_original),line:{fill:FOREST,width:3},marker:{symbol:"circle",size:5,fill:FOREST}}],hasLegend:false,xAxis:axis("K on fixed screening cohort",{majorGridlines:null}),yAxis:axis("Common-space silhouette",{min:0,max:0.30,numberFormatCode:"0.00"})});
  const contrast=s.runs.find(x=>x.k===10);
  tx(q,"Frozen full-study runs",875,175,340,45,27,{bold:true});
  tx(q,`K = 2     ${n(r.metrics.silhouette_original)}\nK = 10   ${n(contrast?.metrics.silhouette_original)}`,875,250,340,130,34,{bold:true});
  tx(q,"Silhouette in the same\nstandardised descriptor space",875,410,340,95,24,{color:MUTED});
  tx(q,"A stable broad grouping can differ from semantic land-cover categories.",64,595,1152,45,27,{color:MUTED});
}
// 08 - real results/testing
{
  const q=slide("Measured results and interpretation",`25 seconds. The study retained-space silhouette is ${n(r.metrics.silhouette)} and the holdout silhouette is ${n(r.holdout_metrics?.silhouette)}. Mean seed ARI is ${n(r.stability,4)}. Agreement with EuroSAT labels is lower: study ARI is ${n(a.metrics?.adjusted_rand_index)} and NMI is ${n(a.metrics?.normalized_mutual_information)}. Explain why a reproducible visual partition can group several land categories together. Sources: artifacts/study.json and artifacts/audit.json.`);
  tab(q,[["Evidence","Recorded value","Meaning"],["Study / holdout silhouette",`${n(r.metrics.silhouette)} / ${n(r.holdout_metrics?.silhouette)}`,"Retained-space geometry"],["Seed stability ARI",n(r.stability,4),"Consistent broad split"],["Post-selection ARI / NMI",`${n(a.metrics?.adjusted_rand_index)} / ${n(a.metrics?.normalized_mutual_information)}`,"Limited class agreement"]],64,170,1152,300,[380,280,492],24);
  tx(q,"Finding: strong consistency does not establish semantic correctness",64,515,1152,90,32,{bold:true});
  tx(q,"Checks cover numerical invariants, invalid uploads, API exports and the interface build",64,612,1152,35,22,{color:MUTED});
}
// 09 - real app evidence
{
  const q=slide("Working application",`20 seconds. Name the six views, then save detailed interaction for the separate live demo. Observatory, Projection Lab, Cluster Atlas, Experiment Bench, Patch Analyzer and Study & Evidence are connected to real API data. Live experiments are bounded; t-SNE comparisons are precomputed genuine runs. The source includes recorded results, uploads and export routes. Screenshot is captured from the working application when available.`);
  const available=await img(q,path.join(ROOT,"docs/screenshots/observatory.png"),64,150,885,455)||await img(q,path.join(ROOT,"docs/screenshots/observatory.jpg"),64,150,885,455);
  if(!available)lines(q,["Observatory and Projection Lab","Cluster Atlas and Experiment Bench","Patch Analyzer and Study & Evidence"],64,185,850,32,115);
  tx(q,"Inspect patches\nCompare parameters\nRun experiments\nAnalyse an upload\nExport evidence",990,175,235,350,25,{bold:true});
  tx(q,"Live demonstration follows the timed presentation",64,624,1152,30,23,{color:MUTED});
}
// 10 - tools/architecture/security
{
  const q=slide("Tools and system design",`20 seconds. Python/scikit-learn implement the numerical study; FastAPI exposes the saved artifacts and bounded actions; React/TypeScript implement the six views. SQLite stores experiment metadata, with temporary runtime storage on a free host. Uploads are bounded and decoded safely; only our trusted generated model is loaded. Deployment is single-origin frontend plusAPI, and the live link must be verified. See appendix for API details.`);
  tab(q,[["Layer","Technology","Responsibility"],["Study","Python · scikit-learn · scikit-image","Features, PCA, t-SNE, clustering"],["Service","FastAPI · SQLite","Validation, inference, experiment jobs"],["Interface","React · TypeScript · Vite","Linked scientific inspection"],["Delivery","Single service + compact artifacts","Runnable source and deployment"]],64,170,1152,350,[235,415,502],24);
  tx(q,"Saved-model upload inference · bounded resources · recorded provenance",64,575,1152,65,28,{color:MUTED});
}
// 11 - limitations future scope impact
{
  const q=slide("Limitations and future scope",`15 seconds. RGB descriptors omit spectral/contextual information and can reflect season or brightness. A random patch holdout is not geographically independent. t-SNE is parameter-sensitive. Appropriate uses are exploration, annotation support and teaching; consequential land-management decisions require expert validation. Future: multispectral features, spatial holdouts, other cluster geometries and separately disclosed pretrained embeddings. Sources: measured limitations in study.json; EuroSAT paper; scikit-learn documentation.`);
  lines(q,["RGB and handcrafted descriptors limit semantic detail","Random patch holdout does not prove geographic transfer","t-SNE geometry and centroid distance require careful interpretation"],64,165,1152,29,95);
  tx(q,"Next: multispectral features, spatial validation and expert-reviewed groups",64,505,1152,95,32,{bold:true});
}
// 12 - contributions/references and honest AI disclosure
{
  const allCompleted = members.every(member => member.completed_work?.trim());
  const q=slide("Team responsibilities and references",`20 seconds. ${allCompleted ? "Summarise each member's recorded work." : "Describe the assigned responsibilities. Record each member's actual contribution once they complete it."} Codex assisted implementation and drafting. End the main talk here at about four minutes. Use the appendix for questions. Sources: https://github.com/phelber/EuroSAT, https://arxiv.org/abs/1709.00029, https://scikit-learn.org/stable/modules/clustering.html, https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html, https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html.`);
  const workRows = members.map(member => {
    const completed = member.completed_work?.trim();
    const description = completed || member.responsibility || "Confirm responsibilities before submission";
    const status = completed ? "Completed" : "Assigned";
    return [`${member.name} / ${member.registration_number}`, allCompleted ? description : `${status}: ${description}`];
  });
  tab(q,[["Member / registration",allCompleted ? "Completed work" : "Responsibility and status"],...workRows],64,155,1152,250,[560,592],23);
  const assistance = "Codex assisted implementation and drafting. The team verifies and explains the work.";
  tx(q,allCompleted ? assistance : `Completion records are pending. Update them before submission.\n${assistance}`,64,435,1152,80,24,{color:MUTED});
  tx(q,"References: EuroSAT creators and paper · scikit-learn PCA/t-SNE/clustering · INT396 syllabus",64,565,1152,80,23);
}
// 13 - appendix: editable system diagram
{
  const q=slide("Architecture and upload workflow",`Appendix. The offline pipeline writes immutable artifacts, which FastAPI serves to React. Uploaded images pass through saved preprocessing and centroids; the model is not refitted. A separate bounded experiment uses anonymous study descriptors and records independent results in SQLite/disk. GET/api/capabilities advertises host limits. Sources: backend/terralens and docs/API_CONTRACT.md.`,{appendix:true});
  const a1=node(q,"Study artifacts\nJSON + model + previews",64,170,320),a2=node(q,"FastAPI\nvalidation and jobs",480,170,320),a3=node(q,"React\nsix inspection views",896,170,320);
  arrow(q,a1,a2);arrow(q,a2,a3);
  const b1=node(q,"Image upload",64,390,260),b2=node(q,"Saved feature / scaler / PCA\nnearest centroid",430,390,420),b3=node(q,"Group + distance\nPCA + examples",950,390,266);
  arrow(q,b1,b2);arrow(q,b2,b3);
  tx(q,"GET /study   ·   POST /experiments   ·   POST /analyze   ·   GET /export/metrics.csv",64,575,1152,60,25,{color:MUTED});
}
// 14 - appendix: feature contributions and ablation table
{
  const q=slide("Feature contributions and ablations",`Appendix. Read loadings as contribution to an axis, not causal land-cover importance. PC1 is associated with brightness/entropy versus energy. Standardising helps common-scale comparison, but feature family sizes and correlations still matter. The unscaled own-space silhouette is much larger, yet common-space silhouette is lower; this shows why changing metric space can mislead. Source: artifacts/study.json; features.py.` ,{appendix:true});
  const ab=s.experiments.ablations||[];
  tab(q,[["Representation","Own silhouette","Common silhouette"],...ab.map(x=>[x.name,n(x.metrics.silhouette),n(x.metrics.silhouette_original)]),["Selected PCA95",n(r.metrics.silhouette),n(r.metrics.silhouette_original)]],64,160,1152,260,[600,276,276],22);
  const top=s.pca.loadings[0].features.slice(0,4).map(f=>`${f.name}  ${f.loading>=0?"+":""}${f.loading.toFixed(3)}`).join("\n");
  tx(q,"PC1 contributions",64,465,430,45,28,{bold:true});
  tx(q,top,550,455,640,155,25);
}
// 15 - appendix: sensitivity/metrics
{
  const q=slide("t-SNE parameters and metric definitions",`Appendix. Six saved runs use perplexities10/30/50 and seeds42/17, random initialisation,750iterations and50input PCA components. Trustworthiness uses the same1000-patch subset,10neighbours and full standardised descriptor reference. It is local preservation, not accuracy. Silhouette is higher-is-better in the stated space; DB lower; stability is mean pairwise ARI. Source: actual study experiment metadata.`,{appendix:true});
  tab(q,[["Perplexity","Seed","Trustworthiness","Seconds"],...s.tsne_runs.map(x=>[String(x.perplexity),String(x.seed),n(x.trustworthiness),n(x.runtime_seconds,2)])],64,150,720,425,[160,100,270,190],21);
  tx(q,"Silhouette: separation\nDB: compactness/separation\nSeed ARI: consistency\nTrustworthiness: neighbours\nExternal ARI/NMI: audit",835,180,365,330,25);
  tx(q,"None of these is ten-class prediction accuracy",64,610,1152,40,25,{bold:true});
}
// 16 - appendix: reproduction and final checks
{
  const q=slide("Reproduction and final submission",`Appendix. Follow README for the compact demonstration and full study reproduction. Verify the archive checksum and recorded versions. Record each member's completed work in team.json and regenerate the report and slides. Then run python scripts/package_submission.py --final. This creates three byte-identical copies named INT396_RegNo.zip. Each member uploads their own copy. Repository: ${links.github||"not populated"}. Deployment: ${links.deployment||"not populated"}.`,{appendix:true});
  lines(q,["Verify the dataset archive, run the study and inspect the results","Run application checks and capture screenshots","Record completed work in team.json and regenerate the documents","Create one INT396_RegNo.zip per member with identical contents"],64,165,1152,27,95);
  tx(q,links.github||"Verified repository URL required",64,575,1152,35,23,{color:TEAL});
  tx(q,links.deployment||"Verified live deployment URL still required",64,615,1152,35,23,{color:TEAL});
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
