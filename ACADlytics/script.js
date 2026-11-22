"use strict";

const iconPaths = {
  logo:'<path d="M3 25V15m8 10V5m8 20V11m8 14V2"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  chart:'<path d="M4 3v17h17M8 16v-5m5 5V6m5 10V9"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  teaching:'<path d="m2 8 10-5 10 5-10 5L2 8Zm4 3v6c3 3 9 3 12 0v-6m4-3v8"/>',
  records:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8m-8 4h8m-8 4h5"/>',
  database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/>',
  home:'<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3V10Z"/>',
  building:'<path d="M4 21V7l8-4 8 4v14H4Zm5 0v-6h6v6M8 9h1m6 0h1m-8 3h1m6 0h1"/>',
  people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3c0-6 12-6 12 0v3m1-17c5 0 5 7 0 7m2 3c3 0 4 2 4 5v2"/>',
  star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  trend:'<path d="m3 17 6-6 4 4 8-10m-6 0h6v6"/>',
  filter:'<path d="M4 5h16l-6 7v7l-4 2v-9L4 5Z"/>',
  reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8 13h4"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  spark:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/>',
  'chevron-left':'<path d="m14 6-6 6 6 6"/>',
  'chevron-right':'<path d="m10 6 6 6-6 6"/>',
  'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>'
};
document.querySelectorAll('[data-icon]').forEach(node => {
  node.innerHTML = `<svg class="icon" viewBox="0 0 ${node.dataset.icon === 'logo' ? '30 30' : '24 24'}" aria-hidden="true">${iconPaths[node.dataset.icon] || ''}</svg>`;
});

const $ = id => document.getElementById(id);
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const mean = values => values.length ? values.reduce((sum,value) => sum+value,0)/values.length : null;
const numeric = value => value !== '' && value != null && Number.isFinite(Number(value));
const pct = (part,total) => total ? part/total*100 : 0;
const format = value => value == null ? '—' : value.toFixed(2);
const unique = (rows,key) => [...new Set(rows.map(row => row[key]))].sort((a,b) => a.localeCompare(b,undefined,{numeric:true}));
const validGrades = rows => rows.filter(row => numeric(row.Final_Grade));
const submitted = rows => rows.filter(row => row.SETE_Eligible==='Yes' && row.SETE_Submitted==='Yes' && numeric(row.SETE_Average_Rating));
const onTrack = row => numeric(row.Final_Grade) && Number(row.Final_Grade)>=1 && Number(row.Final_Grade)<=2.75;
const atRisk = row => numeric(row.Final_Grade) && Number(row.Final_Grade)===3;
const failedRecord = row => numeric(row.Final_Grade) && Number(row.Final_Grade)===5;
const passed = row => row.Grade_Status==='Passed';
let allRecords=[], filteredRecords=[];
let predictionByRecordId=new Map(), predictionLoadMessage='Prediction file is unavailable. Historical Risk Simulation data is not shown.';
let predictionRiskFilter='all', predictionSearch='', predictionSortDirection=-1, predictionPage=1;
let predictionBackState=null;
const predictionPageSize=8;
let selectedDimension=null;
let page=1, sortKey='Student_ID', sortDirection=1, riskExpanded=false;
const pageSize=8;
const filters=['academicYearFilter','semesterFilter','yearFilter','subjectFilter'];
const filterFields=['Academic_Year','Semester','Year_Level','Subject_Name'];
const isDashboard=document.body.dataset.page==='dashboard';

// A normal refresh always starts at the dashboard header. User-triggered
// section navigation still works because it happens after page initialization.
if(isDashboard) {
  history.scrollRestoration='manual';
  if(location.hash) history.replaceState(null,'',location.pathname+location.search);
  window.scrollTo(0,0);
  window.addEventListener('pageshow',()=>window.scrollTo(0,0),{once:true});
}

// Handles quoted fields, escaped quotes, commas and embedded newlines.
function parseCSV(text, validate=true) {
  const grid=[]; let row=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const char=text[i];
    if(char==='"') {
      if(quoted&&text[i+1]==='"') {cell+='"';i++;}
      else if(quoted||cell==='') quoted=!quoted;
      else throw new Error('Unexpected quote in CSV field.');
    } else if(char===','&&!quoted) {row.push(cell.trim());cell='';}
    else if((char==='\n'||char==='\r')&&!quoted) {
      if(char==='\r'&&text[i+1]==='\n') i++;
      row.push(cell.trim());if(row.some(Boolean)) grid.push(row);row=[];cell='';
    } else cell+=char;
  }
  if(quoted) throw new Error('The CSV contains an unclosed quoted field.');
  row.push(cell.trim());if(row.some(Boolean)) grid.push(row);
  if(grid.length<2) throw new Error('The CSV must contain headers and at least one record.');
  const headers=grid.shift();
  if(new Set(headers).size!==headers.length) throw new Error('The CSV has duplicate column names.');
  if(!validate) return grid.map(values=>Object.fromEntries(headers.map((header,i)=>[header,values[i]])));
  const required=['Student_ID','Year_Level','Academic_Year','Semester','Subject_Name','Final_Grade','Grade_Status','Faculty_ID','SETE_Eligible','SETE_Submitted','SETE_Subject_Knowledge','SETE_Teaching_Delivery','SETE_Student_Engagement','SETE_Assessment_Feedback','SETE_Average_Rating','SETE_Previous_Semester_Avg'];
  const missing=required.filter(header => !headers.includes(header));
  if(missing.length) throw new Error(`Missing columns: ${missing.join(', ')}. Download the source CSV for the format.`);
  return grid.map((values,index) => {
    if(values.length!==headers.length) throw new Error(`Row ${index+2} has ${values.length} fields; expected ${headers.length}.`);
    const record=Object.fromEntries(headers.map((header,i) => [header,values[i]]));
    if(['Student_ID','Subject_Name','Faculty_ID','Academic_Year','Semester'].some(key => !record[key])) throw new Error(`Row ${index+2} is missing a required identifier.`);
    if(!['1','2','3','4'].includes(record.Year_Level)) throw new Error(`Row ${index+2}: year level must be 1, 2, 3 or 4.`);
    if(!numeric(record.Final_Grade)||Number(record.Final_Grade)<1||Number(record.Final_Grade)>5) throw new Error(`Row ${index+2}: final grade must be between 1 and 5.`);
    if(!['Passed','Failed'].includes(record.Grade_Status)) throw new Error(`Row ${index+2}: grade status must be Passed or Failed.`);
    if((Number(record.Final_Grade)<=3)!==passed(record)) throw new Error(`Row ${index+2}: grade and status disagree (passing grade is 3.00 or lower).`);
    if(!['Yes','No'].includes(record.SETE_Eligible)||!['Yes','No'].includes(record.SETE_Submitted)) throw new Error(`Row ${index+2}: SETE flags must be Yes or No.`);
    if(record.SETE_Submitted==='Yes'&&record.SETE_Eligible!=='Yes') throw new Error(`Row ${index+2}: a submitted evaluation must be eligible.`);
    const ratings=['SETE_Subject_Knowledge','SETE_Teaching_Delivery','SETE_Student_Engagement','SETE_Assessment_Feedback','SETE_Average_Rating','SETE_Previous_Semester_Avg'];
    for(const key of ratings) {
      if(record[key]!==''&&(!numeric(record[key])||Number(record[key])<1||Number(record[key])>5)) throw new Error(`Row ${index+2}: ${key} must be blank or between 1 and 5.`);
      if(record.SETE_Submitted==='Yes'&&key!=='SETE_Previous_Semester_Avg'&&record[key]==='') throw new Error(`Row ${index+2}: submitted evaluation is missing ${key}.`);
    }
    return record;
  });
}

function message(text,error=false) {
  if(!$('statusMessage')) return;
  $('statusMessage').textContent=text;
  $('statusMessage').classList.toggle('error',error);
  $('statusMessage').hidden=!text;
}

async function loadDataset() {
  try {
    const names=['student_grades.csv','teaching_assignments.csv','sete_responses.csv','sete_semester_trends.csv'];
    const responses=await Promise.all(names.map(name=>fetch(`data/${name}`)));
    const failedResponse=responses.find(response=>!response.ok);
    if(failedResponse) throw new Error(`Dataset request failed (${failedResponse.status}).`);
    const [gradesText,assignmentsText,seteText,trendsText]=await Promise.all(responses.map(response=>response.text()));
    const grades=parseCSV(gradesText,false), assignments=parseCSV(assignmentsText,false), seteResponses=parseCSV(seteText,false), trends=parseCSV(trendsText,false);
    const assignmentById=new Map(assignments.map(row=>[row.assignment_id,row]));
    const responseGroups=new Map(); seteResponses.forEach(row=>{if(!responseGroups.has(row.assignment_id)) responseGroups.set(row.assignment_id,[]); responseGroups.get(row.assignment_id).push(row);});
    const trendByTerm=new Map(trends.map(row=>[`${row.academic_year}|${row.semester}`,row]));
    const average=(rows,key)=>mean(rows.map(row=>Number(row[key])).filter(Number.isFinite));
    const submittedCounts=new Map();
    allRecords=grades.map(grade=>{
      const assignment=assignmentById.get(grade.assignment_id)||{}, responsesForAssignment=responseGroups.get(grade.assignment_id)||[], recordIndex=submittedCounts.get(grade.assignment_id)||0; submittedCounts.set(grade.assignment_id,recordIndex+1); const submittedForRecord=recordIndex < responsesForAssignment.length;
      const current=average(responsesForAssignment,'overall_rating'), knowledge=average(responsesForAssignment,'subject_mastery'), delivery=average(responsesForAssignment,'teaching_methods'), engagement=average(responsesForAssignment,'student_engagement'), feedback=average(responsesForAssignment,'communication');
      const trend=trendByTerm.get(`${grade.academic_year}|${grade.semester}`), previous=current==null||!trend?'':(current-Number(trend.previous_semester_change)).toFixed(2);
      return {Record_ID:grade.record_id,Assignment_ID:grade.assignment_id,Student_ID:grade.student_id,Year_Level:assignment.year_level||grade.year_level,Section:assignment.section||grade.section,Academic_Year:assignment.academic_year||grade.academic_year,Semester:(assignment.semester||grade.semester)==='1'?'1st Semester':'2nd Semester',Subject_Code:assignment.subject_code||grade.subject_code,Subject_Name:assignment.subject_name||grade.subject_name,Final_Grade:grade.final_grade,Grade_Status:Number(grade.final_grade)<=3?'Passed':'Failed',Faculty_ID:grade.faculty_id,Attendance_Pct:grade.attendance_pct,Quiz_Average:grade.quiz_average,Midterm_Score:grade.midterm_score,SETE_Eligible:'Yes',SETE_Submitted:submittedForRecord?'Yes':'No',SETE_Subject_Knowledge:submittedForRecord?knowledge:'',SETE_Teaching_Delivery:submittedForRecord?delivery:'',SETE_Student_Engagement:submittedForRecord?engagement:'',SETE_Assessment_Feedback:submittedForRecord?feedback:'',SETE_Average_Rating:submittedForRecord?current:'',SETE_Previous_Semester_Avg:submittedForRecord?previous:''};
    }).map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value==null?'':String(value)])));
    try {
      const predictionResponse=await fetch('data/risk_predictions.csv?local-model='+encodeURIComponent('acadlytics_midterm_failure_v2'),{cache:'no-store'});
      if(!predictionResponse.ok) throw new Error(`Prediction file request failed (${predictionResponse.status}).`);
      const predictionRows=parseCSV(await predictionResponse.text(),false);
      const required=['record_id','failure_risk_score_pct','predicted_risk_level','subject_name'];
      const missing=required.filter(header=>!Object.prototype.hasOwnProperty.call(predictionRows[0]||{},header));
      if(missing.length) throw new Error(`Prediction file is missing: ${missing.join(', ')}.`);
      predictionByRecordId=new Map();
      predictionRows.forEach(row=>{
        if(!row.record_id||!numeric(row.failure_risk_score_pct)||!row.predicted_risk_level) return;
        if(predictionByRecordId.has(row.record_id)) throw new Error(`Duplicate prediction record_id: ${row.record_id}.`);
        predictionByRecordId.set(row.record_id,row);
      });
      allRecords=allRecords.map(row=>{const prediction=predictionByRecordId.get(row.Record_ID);return prediction?{...row,Prediction_Score:prediction.failure_risk_score_pct,Prediction_Level:prediction.predicted_risk_level,Prediction_Type:prediction.prediction_type||'',Prediction_Model:prediction.model_version||'',Prediction_Screening_Point:prediction.screening_point||''}:row;});
      const matchedPredictionCount=allRecords.filter(row=>predictionByRecordId.has(row.Record_ID)).length;
      predictionLoadMessage=`Historical Risk Simulation loaded for ${matchedPredictionCount} matched records. Scores are model-generated screening estimates, not guaranteed probabilities of failure.`;
    } catch(predictionError) {
      predictionByRecordId=new Map();
      predictionLoadMessage=`${predictionError.message} Historical Risk Simulation is unavailable; recorded academic results remain available.`;
    }
    if(isDashboard) {populateFilters();updateDashboard();}
    else renderLanding();
  } catch(error) {
    if(isDashboard) {
      message(`${error.message} Open this page through localhost with Apache running and check that the files in data/ are available.`,true);
      updateDashboard();
      $('contextText').textContent='Dataset unavailable';
    } else {
      $('previewBars').innerHTML='<span class="muted">Open via localhost to load the dataset.</span>';
    }
  }
}

function renderLanding() {
  const stats={students:unique(allRecords,'Student_ID').length,passing:`${pct(allRecords.filter(passed).length,allRecords.length).toFixed(1)}%`,records:allRecords.length,subjects:unique(allRecords,'Subject_Name').length,faculty:unique(allRecords,'Faculty_ID').length};
  document.querySelectorAll('[data-landing]').forEach(node => node.textContent=stats[node.dataset.landing]);
  $('previewBars').innerHTML=unique(allRecords,'Year_Level').map(year => {
    const group=allRecords.filter(row => row.Year_Level===year),rate=pct(group.filter(passed).length,group.length);
    return `<div class="mini-bar" style="height:${rate*.86}%"><b>${rate.toFixed(1)}%</b><small>Year ${escapeHTML(year)}</small></div>`;
  }).join('');
}

function populateFilters() {
  filters.forEach((id,i) => {
    const select=$(id);
    while(select.options.length>1) select.remove(1);
    const values=i===0?['2025-2026','2026-2027']:i===1?['1st Semester','2nd Semester']:unique(allRecords,filterFields[i]);
    values.forEach(value => select.add(new Option(i===2?`Year ${value}`:value,value)));
    select.value='all';
  });
}

function updateDashboard() {
  hideTooltip(); filteredRecords=allRecords.filter(row=>filters.every((id,i)=>$(id).value==='all'||row[filterFields[i]]===$(id).value)); page=1;
  const grades=validGrades(filteredRecords),evaluations=submitted(filteredRecords),eligible=filteredRecords.filter(row=>row.SETE_Eligible==='Yes').length;
  const onTrackCount=grades.filter(onTrack).length,atRiskCount=grades.filter(atRisk).length,failedCount=grades.filter(failedRecord).length;
  $('passingRate').textContent=grades.length?`${pct(onTrackCount,grades.length).toFixed(1)}%`:'—'; $('passedCount').textContent=`${onTrackCount} on-track records`;
  $('riskCount').textContent=grades.length?`${pct(atRiskCount,grades.length).toFixed(1)}%`:'—'; $('riskRecordCount').textContent=`${atRiskCount} records`;
  $('failedRate').textContent=grades.length?`${pct(failedCount,grades.length).toFixed(1)}%`:'—'; $('failedRecordCount').textContent=`${failedCount} records`;
  const seteAverage=mean(evaluations.map(row=>Number(row.SETE_Average_Rating))); $('seteAverage').textContent=format(seteAverage); $('responseRate').textContent=eligible?`${pct(evaluations.length,eligible).toFixed(1)}%`:'—'; $('responseCount').textContent=`${evaluations.length} / ${eligible} submitted`;
  setTargetState('passingTargetStatus',grades.length&&pct(onTrackCount,grades.length)>=80); setTargetState('riskTargetStatus',grades.length&&pct(atRiskCount,grades.length)<=10); setTargetState('failedTargetStatus',grades.length&&pct(failedCount,grades.length)<=5); setTargetState('seteTargetStatus',seteAverage!==null&&seteAverage>=4); setTargetState('responseTargetStatus',eligible>0&&evaluations.length/eligible*100>=70);
  $('passingRate').classList.toggle('metric-positive',grades.length&&pct(onTrackCount,grades.length)>=80); $('passingRate').classList.toggle('metric-negative',grades.length&&pct(onTrackCount,grades.length)<80);
  $('contextText').textContent=`${filteredRecords.length.toLocaleString()} academic records · ${unique(filteredRecords,'Academic_Year').join(', ')||'No matching data'}`; const active=filters.filter(id=>$(id).value!=='all').length; $('filterSummary').textContent=active?`${active} active filter${active>1?'s':''}`:'All records';
  const riskRows=getRiskRecords(); renderYearChart();renderTrendChart();renderSubjects();renderTeaching();renderRisk();renderSectionRisk();renderInsight();renderNotifications(pct(onTrackCount,grades.length),eligible,evaluations.length,riskRows); if(activeKpiCard&&!$('kpiDrawer').hidden)renderKPIDrawer(activeKpiCard.dataset.kpi);
}
function renderNotifications(onTrackRate,eligible,submittedCount,riskRows) { const items=[]; const high=riskRows.filter(failedRecord),borderline=riskRows.filter(atRisk); if(borderline.length) items.push({kind:'warning',title:'Academic Risk Notice',text:`${borderline.length} borderline passing record${borderline.length===1?' was':'s were'} identified. Review Early Support.`,target:'risk'}); if(high.length) items.push({kind:'high',title:'Subject Failure Notice',text:`${high.length} failing grade record${high.length===1?' was':'s were'} identified. Review support and retaking requirements.`,target:'risk'}); if(eligible&&submittedCount/eligible<.7) items.push({kind:'warning',title:'SETE Response Notice',text:'The SETE response rate is below the proposed monitoring threshold.',target:'academics'}); const dimensions=[['Teaching delivery','SETE_Teaching_Delivery'],['Student engagement','SETE_Student_Engagement'],['Assessment & feedback','SETE_Assessment_Feedback'],['Subject knowledge','SETE_Subject_Knowledge']]; const lowDimension=dimensions.find(([label,key])=>{const values=submitted(filteredRecords).filter(row=>numeric(row[key])).map(row=>Number(row[key])); return values.length&&mean(values)<4;}); if(lowDimension) items.push({kind:'warning',title:'Teaching Evaluation Notice',text:`${lowDimension[0]} is below the proposed 4.0/5 monitoring threshold.`,target:'academics'}); const concernSubjects=unique(riskRows,'Subject_Name').slice(0,2); if(concernSubjects.length) items.push({kind:'warning',title:'Subject Attention Notice',text:`Academic concerns need review in ${concernSubjects.join(' and ')}.`,target:'academics'}); if(!items.length) items.push({kind:'good',title:'Dashboard is on track',text:'Current filtered indicators meet their proposed monitoring thresholds.',target:'academics'}); $('notificationCount').textContent=items.length; $('notificationList').innerHTML=items.map(item=>`<button class="notification-item ${item.kind}" data-notification-target="${item.target}"><span class="notification-dot"></span><span><strong>${item.title}</strong><p>${item.text}</p></span></button>`).join(''); }

let activeKpiCard=null;
function listMarkup(items,empty='No matching records in this filtered view.') {
  return items.length?`<ul class="kpi-drawer-list">${items.map(item=>`<li>${escapeHTML(item.label)}<strong>${escapeHTML(item.value)}</strong></li>`).join('')}</ul>`:`<p class="kpi-drawer-empty">${empty}</p>`;
}
function renderKPIDrawer(key) {
  const grades=validGrades(filteredRecords), evaluations=submitted(filteredRecords), eligible=filteredRecords.filter(row=>row.SETE_Eligible==='Yes'), onTrackRows=grades.filter(onTrack), riskRows=grades.filter(atRisk), failedRows=grades.filter(failedRecord);
  const subjects=unique(filteredRecords,'Subject_Name');
  let title='',purpose='',current='',content='';
  const subjectBreakdown=(rows,formatter)=>subjects.map(subject=>{const group=rows.filter(row=>row.Subject_Name===subject);return group.length?{label:subject,value:formatter(group)}:null;}).filter(Boolean);
  if(key==='on-track') {
    title='On-Track Rate'; purpose='Satisfactory subject outcomes'; current=grades.length?`${pct(onTrackRows.length,grades.length).toFixed(1)}%`:'—';
    content=`<section><h3>Filtered academic result</h3><p>${onTrackRows.length} of ${grades.length} valid grade records are classified On Track (${current}) in the current filter selection.</p></section><section><h3>Current result</h3><p><strong>${current}</strong> from ${onTrackRows.length} on-track records out of ${grades.length} valid grade records.</p><p>${onTrackRows.length?'This indicates the share of filtered academic records showing satisfactory subject outcomes.':'No valid grade records match the current filters.'}</p></section><section><h3>Subject breakdown</h3>${listMarkup(subjectBreakdown(onTrackRows,group=>`${group.length} on-track of ${validGrades(group).length} valid (${pct(group.length,validGrades(group).length).toFixed(1)}%)`))}</section><section><h3>Why it matters</h3><p>Use this measure to identify subjects and filtered groups that are progressing satisfactorily and where support may be needed.</p></section>`;
  } else if(key==='at-risk') {
    title='Students At Risk'; purpose='Borderline passing · Grade 3.00'; current=grades.length?`${pct(riskRows.length,grades.length).toFixed(1)}%`:'—';
    content=`<section><h3>Filtered academic result</h3><p>${riskRows.length} grade record${riskRows.length===1?'':'s'} with a final grade of 3.00 were found in the current selection (${current}).</p></section><section><h3>Current result</h3><p><strong>${riskRows.length} At-Risk Grade Records</strong> (${current}) out of ${grades.length} valid grade records.</p><p>Grade 3.00 is technically passing but is classified here as borderline for additional monitoring.</p></section><section><h3>Affected subjects</h3>${listMarkup(subjectBreakdown(riskRows,group=>`${group.length} borderline record${group.length===1?'':'s'}`))}</section><section><h3>Suggested faculty action</h3><p>Consider additional monitoring, consultation, and targeted academic support for affected records.</p></section>`;
  } else if(key==='failed') {
    title='Failed Grade Records'; purpose='Risk of Repeating the Subject'; current=grades.length?`${pct(failedRows.length,grades.length).toFixed(1)}%`:'—';
    content=`<section><h3>Filtered academic result</h3><p>${failedRows.length} grade record${failedRows.length===1?'':'s'} with a final grade of 5.00 were found in the current selection (${current}).</p></section><section><h3>Current result</h3><p><strong>${failedRows.length} failed grade records</strong> (${current}) out of ${grades.length} valid grade records.</p><p>These are recorded failures, not predictions, and may carry a risk of repeating the subject.</p></section><section><h3>Subject breakdown</h3>${listMarkup(subjectBreakdown(failedRows,group=>`${group.length} failed record${group.length===1?'':'s'}`))}</section><section><h3>Suggested faculty action</h3><p>Review the records and coordinate academic consultation, remediation, or subject retaking based on institutional policies.</p></section>`;
  } else if(key==='sete-average') {
    title='Average SETE Rating'; purpose='Teaching effectiveness'; current=format(mean(evaluations.map(row=>Number(row.SETE_Average_Rating))));
    const dimensions=[['Subject knowledge','SETE_Subject_Knowledge'],['Teaching delivery','SETE_Teaching_Delivery'],['Student engagement','SETE_Student_Engagement'],['Assessment & feedback','SETE_Assessment_Feedback']];
    const dimensionRows=dimensions.map(([label,keyName])=>{const values=evaluations.filter(row=>numeric(row[keyName])).map(row=>Number(row[keyName]));return values.length?{label,value:`${format(mean(values))} / 5`}:null;}).filter(Boolean);
    content=`<section><h3>Filtered evaluation result</h3><p>${evaluations.length} submitted SETE evaluation responses are available in the current selection, with an average rating of ${current} / 5.</p></section><section><h3>Current result</h3><p><strong>${current} / 5</strong> from ${evaluations.length} submitted evaluation responses.</p><p>${evaluations.length?'This summarizes the teaching feedback available in the current filtered view.':'No submitted evaluations match the current filters.'}</p></section><section><h3>Evaluation dimensions</h3>${listMarkup(dimensionRows,'No submitted dimension ratings are available.')}</section><section><h3>Subject-level ratings</h3>${listMarkup(subjectBreakdown(evaluations,group=>`${format(mean(group.map(row=>Number(row.SETE_Average_Rating))))} / 5`),'No subject-level SETE ratings are available.')}</section>`;
  } else {
    title='SETE Response Rate'; purpose='Evaluation participation'; current=eligible.length?`${pct(evaluations.length,eligible.length).toFixed(1)}%`:'—';
    content=`<section><h3>Filtered evaluation result</h3><p>${evaluations.length} of ${eligible.length} eligible SETE evaluations were submitted in the current selection (${current}).</p></section><section><h3>Current result</h3><p><strong>${current}</strong> from ${evaluations.length} submitted evaluations out of ${eligible.length} eligible evaluations.</p><p>${eligible.length?`${eligible.length-evaluations.length} eligible evaluation${eligible.length-evaluations.length===1?' remains':'s remain'} unsubmitted.`:'No eligible evaluations match the current filters.'}</p></section><section><h3>Subject breakdown</h3>${listMarkup(subjects.map(subject=>{const group=filteredRecords.filter(row=>row.Subject_Name===subject&&row.SETE_Eligible==='Yes'),submittedGroup=group.filter(row=>row.SETE_Submitted==='Yes');return group.length?{label:subject,value:`${submittedGroup.length} / ${group.length} submitted (${pct(submittedGroup.length,group.length).toFixed(1)}%)`}:null;}).filter(Boolean),'No eligible SETE records are available.')}</section><section><h3>Why it matters</h3><p>Response participation helps faculty interpret whether SETE ratings represent a broad enough set of eligible student feedback.</p></section>`;
  }
  $('kpiDrawerTitle').textContent=title; $('kpiDrawerPurpose').textContent=purpose; $('kpiDrawerCurrent').textContent=current; $('kpiDrawerBody').innerHTML=content;
}
function openKPIDrawer(card) {
  activeKpiCard=card; renderKPIDrawer(card.dataset.kpi); $('kpiDrawer').hidden=false; $('kpiDrawerOverlay').hidden=false; document.body.classList.add('drawer-open'); $('kpiDrawerClose').focus();
}
function closeKPIDrawer() {
  $('kpiDrawer').hidden=true; $('kpiDrawerOverlay').hidden=true; document.body.classList.remove('drawer-open'); activeKpiCard?.focus();
}
function setupKPIDrawer() {
  if($('kpiDrawer')) return;
  document.body.insertAdjacentHTML('beforeend','<div id="kpiDrawerOverlay" class="kpi-drawer-overlay" hidden></div><aside id="kpiDrawer" class="kpi-drawer" aria-labelledby="kpiDrawerTitle" aria-describedby="kpiDrawerPurpose" aria-modal="true" role="dialog" hidden><div class="kpi-drawer-header"><div><h2 id="kpiDrawerTitle">KPI details</h2><p id="kpiDrawerPurpose"></p></div><button id="kpiDrawerClose" class="kpi-drawer-close" type="button" aria-label="Close KPI details">×</button></div><div class="kpi-drawer-current"><span>Current result</span><strong id="kpiDrawerCurrent">—</strong></div><div id="kpiDrawerBody" class="kpi-drawer-body"></div></aside>');
  $('kpiDrawerClose').addEventListener('click',closeKPIDrawer); $('kpiDrawerOverlay').addEventListener('click',closeKPIDrawer); document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('kpiDrawer').hidden)closeKPIDrawer();});
}
function setupProfileMenu() {
  const avatar=document.querySelector('.avatar-small'); if(!avatar||$('profileMenu')) return;
  avatar.outerHTML='<button id="profileButton" class="avatar avatar-small" type="button" aria-label="Open Joseph Bautista profile" aria-expanded="false">JB</button>';
  document.querySelector('.topbar-right').insertAdjacentHTML('beforeend','<div id="profileMenu" class="profile-menu" hidden><strong>Joseph Bautista</strong><span>Faculty Member</span></div>');
  const button=$('profileButton'), menu=$('profileMenu'); let hoverTimer;
  const close=()=>{menu.hidden=true;button.setAttribute('aria-expanded','false');};
  const scheduleClose=()=>{clearTimeout(hoverTimer);hoverTimer=setTimeout(close,160);};
  const open=()=>{clearTimeout(hoverTimer);menu.hidden=false;button.setAttribute('aria-expanded','true');};
  button.addEventListener('click',event=>{event.stopPropagation();menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden));});
  button.addEventListener('mouseenter',open); button.addEventListener('mouseleave',scheduleClose); menu.addEventListener('mouseenter',open); menu.addEventListener('mouseleave',scheduleClose);
  menu.addEventListener('click',event=>event.stopPropagation());
  document.addEventListener('click',close); document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
}
function setupDashboardUI() {
  $('pageTitle').innerHTML='Welcome, Sir Joseph<span class="brand-dot">!</span>'; document.querySelector('.session-label')?.remove(); document.querySelector('.avatar-small').textContent='JB';
  const analyticsGrid=document.querySelector('.analytics-grid'); if(analyticsGrid&&!$('trendChart')) analyticsGrid.insertAdjacentHTML('beforeend','<section class="panel trend-panel"><div class="panel-heading"><div><h2>Academic Performance Trend</h2><p>On-track rate by semester</p></div><span class="panel-icon" data-icon="trend"></span></div><div id="trendChart" class="trend-chart" aria-live="polite"></div><div class="panel-footer"><span><i class="legend-dot red"></i>On-Track Rate (%)</span><span>Filtered records</span></div></section>');
  if(analyticsGrid&&!$('subjectChart')) analyticsGrid.insertAdjacentHTML('beforeend','<section class="panel subject-panel"><div class="panel-heading"><div><h2>Subject Performance</h2><p>Average grade by subject</p></div><span class="neutral-tag" id="subjectBadge">— subjects</span></div><div id="subjectChart" class="subject-chart" aria-live="polite"></div><div id="subjectDetail" class="subject-detail" hidden></div><div class="panel-footer"><span><i class="legend-dot red"></i>Average grade</span><span>Click a subject to explore ↗</span></div></section>');
  document.querySelector('.filter-caption')?.remove();
  const jumpNav=document.querySelector('.dashboard-jump'); if(jumpNav&&!$('exportReport')) jumpNav.insertAdjacentHTML('beforeend','<button id="exportReport" class="export-button" type="button"><span data-icon="download"></span>Export report</button>');
  const grid=document.querySelector('.metric-grid'); grid.innerHTML=`<article class="metric-card jump-card" data-target="academics" tabindex="0"><div class="metric-top"><span>On-Track Rate</span><span class="metric-icon" data-icon="trend" data-tooltip="Grades from 1.00 to 2.75 divided by valid grade records."></span></div><small class="metric-purpose">Satisfactory subject outcomes</small><strong id="passingRate">—</strong><div class="metric-foot"><span class="status-tag" id="passingTargetStatus">Target: ≥80%</span><span id="passedCount">— records</span></div></article><article class="metric-card jump-card" data-target="risk" tabindex="0"><div class="metric-top"><span>Students At Risk</span><span class="metric-icon" data-icon="people" data-tooltip="Records with a final grade of exactly 3.00."></span></div><small class="metric-purpose">Borderline passing · Grade 3.00</small><strong id="riskCount">—</strong><div class="metric-foot"><span class="status-tag" id="riskTargetStatus">Target: ≤10%</span><span id="riskRecordCount">— records</span></div></article><article class="metric-card jump-card" data-target="risk" tabindex="0"><div class="metric-top"><span>Failed Grade Records</span><span class="metric-icon" data-icon="chart" data-tooltip="Recorded grade 5.00 outcomes, not predictions."></span></div><small class="metric-purpose">Risk of repeating the subject</small><strong id="failedRate">—</strong><div class="metric-foot"><span class="status-tag" id="failedTargetStatus">Target: ≤5%</span><span id="failedRecordCount">— records</span></div></article><article class="metric-card jump-card" data-target="teaching" tabindex="0"><div class="metric-top"><span>Average SETE Rating</span><span class="metric-icon" data-icon="star" data-tooltip="Average submitted SETE rating on a 5-point scale."></span></div><small class="metric-purpose">Teaching effectiveness</small><strong id="seteAverage">—</strong><div class="metric-foot"><span class="status-tag" id="seteTargetStatus">Target: ≥4.0/5</span><span>Proposed benchmark</span></div></article><article class="metric-card jump-card" data-target="teaching" tabindex="0"><div class="metric-top"><span>SETE Response Rate</span><span class="metric-icon" data-icon="check-circle" data-tooltip="Submitted eligible evaluations divided by eligible records."></span></div><small class="metric-purpose">Evaluation participation</small><strong id="responseRate">—</strong><div class="metric-foot"><span class="status-tag" id="responseTargetStatus">Target: ≥70%</span><span id="responseCount">— submitted</span></div></article>`;
  const kpiKeys=['on-track','at-risk','failed','sete-average','sete-response']; grid.querySelectorAll('.metric-card').forEach((card,index)=>{card.dataset.kpi=kpiKeys[index]; if(!card.querySelector('.metric-view-details')) card.insertAdjacentHTML('beforeend','<span class="metric-view-details">View details <span aria-hidden="true">↗</span></span>');}); setupKPIDrawer();
  document.querySelectorAll('[data-icon]').forEach(node=>{if(!node.querySelector('svg')) node.innerHTML=`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[node.dataset.icon]||''}</svg>`;});
  const topbar=document.querySelector('.topbar-right'); if(!$('notificationButton')) { topbar.insertAdjacentHTML('afterbegin','<div class="notification-wrap"><button id="notificationButton" class="notification-button" type="button" aria-label="Open notifications" aria-expanded="false"><span data-icon="bell"></span><b id="notificationCount">0</b></button><div id="notificationPanel" class="notification-panel" hidden><div class="notification-heading"><strong>Notifications</strong><button id="closeNotifications" type="button" aria-label="Close notifications">×</button></div><div id="notificationList"></div></div></div>'); const bell=$('notificationButton').querySelector('[data-icon]');bell.innerHTML=`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${iconPaths.bell}</svg>`; }
  const heading=document.querySelector('#risk .panel-heading'); if(heading&&!$('riskLevelFilter')) { document.querySelector('#risk .panel-heading #riskBadge')?.remove(); heading.insertAdjacentHTML('beforeend','<div class="risk-controls"><select id="riskLevelFilter" class="compact-select" aria-label="Filter risk records"><option value="all">All risk records</option><option value="Moderate">At Risk · 3.00</option><option value="High">Failed · 5.00</option></select><span class="neutral-tag" id="riskBadge">— records</span></div>'); document.querySelector('#risk .table-wrapper').insertAdjacentHTML('afterend','<div class="risk-footer"><span id="riskSummary">Showing priority records</span><button id="showMoreRisk" class="text-link" type="button">Show more</button></div>'); }
  const riskPanel=document.querySelector('#risk'); if(riskPanel&&!$('toggleRiskData')) { riskPanel.querySelector('.panel-heading').insertAdjacentHTML('beforeend','<button id="toggleRiskData" class="risk-toggle" type="button" aria-expanded="false">Show students at risk</button>'); riskPanel.querySelector('.table-wrapper').hidden=true; riskPanel.querySelector('.risk-footer').hidden=true; $('toggleRiskData').addEventListener('click',()=>{const show=$('toggleRiskData').getAttribute('aria-expanded')!=='true'; $('toggleRiskData').setAttribute('aria-expanded',String(show)); $('toggleRiskData').textContent=show?'Hide students at risk':'Show students at risk'; riskPanel.querySelector('.table-wrapper').hidden=!show; riskPanel.querySelector('.risk-footer').hidden=!show;}); }
  document.querySelector('#risk .panel-heading p').textContent='Grade 3.00 is borderline passing; grade 5.00 is a recorded failure.';
}

function legacyUpdateDashboard() {
  hideTooltip();
  filteredRecords=allRecords.filter(row => filters.every((id,i) => $(id).value==='all'||row[filterFields[i]]===$(id).value));
  page=1;
  const grades=validGrades(filteredRecords),evaluations=submitted(filteredRecords);
  const passedCount=grades.filter(passed).length,eligible=filteredRecords.filter(row => row.SETE_Eligible==='Yes').length;
  $('totalStudents').textContent=unique(filteredRecords,'Student_ID').length.toLocaleString();
  $('passingRate').textContent=grades.length?`${pct(passedCount,grades.length).toFixed(1)}%`:'—';
  $('averageGrade').textContent=format(mean(grades.map(row => Number(row.Final_Grade))));
  $('seteAverage').textContent=format(mean(evaluations.map(row => Number(row.SETE_Average_Rating))));
  $('subjectCount').textContent=`${unique(filteredRecords,'Subject_Name').length} subjects`;
  $('passedCount').textContent=`${passedCount} passed`;
  $('responseRate').textContent=eligible?`${pct(evaluations.length,eligible).toFixed(1)}%`:'—';
  $('responseCount').textContent=`${evaluations.length} / ${eligible} submitted`;
  const passingRate=grades.length?pct(passedCount,grades.length):null, averageGrade=mean(grades.map(row => Number(row.Final_Grade))), riskRows=getRiskRecords();
  $('riskCount').textContent=unique(riskRows,'Student_ID').length.toLocaleString();
  setTargetState('passingTargetStatus',passingRate!==null&&passingRate>=80);setTargetState('averageTargetStatus',averageGrade!==null&&averageGrade<=3);
  const seteAverage=mean(evaluations.map(row=>Number(row.SETE_Average_Rating)));setTargetState('seteTargetStatus',seteAverage!==null&&seteAverage>=4);setTargetState('responseTargetStatus',eligible>0&&evaluations.length/eligible*100>=70);
  $('passingRate').classList.toggle('metric-positive',passingRate!==null&&passingRate>=80);$('passingRate').classList.toggle('metric-negative',passingRate!==null&&passingRate<80);
  $('contextText').textContent=`${filteredRecords.length.toLocaleString()} academic records · ${unique(filteredRecords,'Academic_Year').join(', ')||'No matching data'}`;
  const active=filters.filter(id => $(id).value!=='all').length;
  $('filterSummary').textContent=active?`${active} active filter${active>1?'s':''}`:'All records';
  renderTrendChart();renderSubjects();renderTeaching();renderRisk();renderSectionRisk();renderInsight();
}

function setTargetState(id,met) { const node=$(id); if(!node)return; node.classList.toggle('target-met',!!met); node.classList.toggle('target-missed',!met); const labels={passingTargetStatus:'Target: ≥80%',riskTargetStatus:'Target: ≤10%',failedTargetStatus:'Target: ≤5%',seteTargetStatus:'Target: ≥4.0/5',responseTargetStatus:'Target: ≥70%'}; node.textContent=`${met?'✓ Target Met':'↓ Needs Attention'} · ${labels[id]||''}`; }
function legacyGetRiskRecords() { return filteredRecords.filter(row => Number(row.Final_Grade)>2.5).sort((a,b)=>Number(b.Final_Grade)-Number(a.Final_Grade)||a.Student_ID.localeCompare(b.Student_ID,undefined,{numeric:true})); }
function getRiskRecords() { return filteredRecords.filter(row=>atRisk(row)||failedRecord(row)).sort((a,b)=>Number(b.Final_Grade)-Number(a.Final_Grade)||a.Student_ID.localeCompare(b.Student_ID,undefined,{numeric:true})); }
function legacyRenderRisk() {
  const groups=new Map(); getRiskRecords().forEach(row=>{const key=`${row.Student_ID}|${row.Subject_Name}`;if(!groups.has(key)||Number(row.Final_Grade)>Number(groups.get(key).Final_Grade)) groups.set(key,row);});
  const rows=[...groups.values()]; $('riskBadge').textContent=`${unique(rows,'Student_ID').length} students`;
  if(!$('riskLegend')) $('riskBadge').insertAdjacentHTML('afterend','<div id="riskLegend" class="risk-legend"><span><i class="risk-dot high"></i>High · failed or &gt; 3.00</span><span><i class="risk-dot moderate"></i>Moderate · 2.51–3.00</span><span><i class="risk-dot low"></i>Low · 2.50 or lower</span></div>');
  $('riskTable').innerHTML=rows.map(row=>{const high=row.Grade_Status==='Failed'||Number(row.Final_Grade)>3;const level=high?'High':'Moderate';return `<tr><td>${escapeHTML(row.Student_ID)}</td><td>${escapeHTML(row.Subject_Name)}</td><td class="grade-cell">${Number(row.Final_Grade).toFixed(2)}</td><td><span class="risk-pill ${level.toLowerCase()}">${level}</span></td><td>${high?'Potentially failing':'At risk of failure'}</td></tr>`;}).join('')||'<tr><td colspan="5" class="empty-state">No students are currently flagged in this selection.</td></tr>';
}

function renderRisk() {
  const selected=$('riskLevelFilter')?.value||'all', all=getRiskRecords(), rows=all.filter(row=>selected==='all'||(selected==='Moderate'?atRisk(row):failedRecord(row))), visible=riskExpanded?rows:rows.slice(0,8);
  $('riskBadge').textContent=`${unique(rows,'Student_ID').length} students`; $('riskSummary').textContent=rows.length?`Showing ${visible.length} of ${rows.length} priority records`:'No matching records'; $('showMoreRisk').hidden=rows.length<=8; $('showMoreRisk').textContent=riskExpanded?'Show less':'Show more';
  $('riskTable').innerHTML=visible.map(row=>atRisk(row)?`<tr class="risk-row"><td>${escapeHTML(row.Student_ID)}</td><td>${escapeHTML(row.Subject_Name)}</td><td class="grade-cell">3.00</td><td><span class="risk-pill moderate">At Risk</span></td><td><strong>At Risk of Failure</strong><small>Borderline passing grade. Additional academic support and monitoring may be recommended.</small></td></tr>`:`<tr class="failed-row"><td>${escapeHTML(row.Student_ID)}</td><td>${escapeHTML(row.Subject_Name)}</td><td class="grade-cell">5.00</td><td><span class="risk-pill high">Failed</span></td><td><strong>Failed — Risk of Repeating the Subject</strong><small>The student has already failed the subject and may need academic consultation, remediation, or subject retaking.</small></td></tr>`).join('')||'<tr><td colspan="5" class="empty-state">No records match this risk filter.</td></tr>';
}

function renderTrendChart() {
  const target=$('trendChart');
  if(!target)return;
  const groups=unique(filteredRecords,'Academic_Year').map(year=>['1st Semester','2nd Semester'].map(semester=>{
    const rows=validGrades(filteredRecords.filter(row=>row.Academic_Year===year&&row.Semester===semester));
    return rows.length?{year,semester,rate:pct(rows.filter(onTrack).length,rows.length)}:null;
  }).filter(Boolean)).reduce((all,items)=>all.concat(items),[]);
  if(!groups.length){target.innerHTML='<div class="no-data">No data available for the selected academic periods.</div>';return;}
  const chartStyle=getComputedStyle(target),contentWidth=target.clientWidth-parseFloat(chartStyle.paddingLeft)-parseFloat(chartStyle.paddingRight);
  const width=Math.max(360,contentWidth||760),height=230,left=54,right=20,top=22,bottom=58,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const x=index=>groups.length===1?left+plotWidth/2:left+index*plotWidth/(groups.length-1);
  const y=value=>top+plotHeight-(value/100)*plotHeight;
  let svg='<svg class="trend-svg" viewBox="0 0 '+width+' '+height+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Academic performance trend showing On-Track Rate percentage by academic period">';
  [0,25,50,75,100].forEach(function(value){svg+='<line class="trend-grid" x1="'+left+'" x2="'+(width-right)+'" y1="'+y(value)+'" y2="'+y(value)+'"></line><text class="trend-axis" x="'+(left-12)+'" y="'+(y(value)+4)+'" text-anchor="end">'+value+'%</text>';});
  const path=groups.map(function(group,index){return (index?'L':'M')+' '+x(index).toFixed(1)+' '+y(group.rate).toFixed(1);}).join(' ');
  svg+='<text class="trend-axis" transform="rotate(-90 16 '+(top+plotHeight/2)+')" x="16" y="'+(top+plotHeight/2)+'" text-anchor="middle">On-Track Rate (%)</text><path class="trend-line" d="'+path+'"></path>';
  groups.forEach(function(group,index){
    const label=group.year+' · '+group.semester;
    const tooltip=label+'\nOn-Track Rate: '+group.rate.toFixed(1)+'%';
    const valueY=Math.max(top+12,y(group.rate)-13);
    svg+='<g class="trend-point" tabindex="0" role="img" aria-label="'+escapeHTML(label+': '+group.rate.toFixed(1)+'% On-Track Rate')+'" data-tooltip="'+escapeHTML(tooltip)+'"><circle cx="'+x(index)+'" cy="'+y(group.rate)+'" r="5"></circle><text class="trend-value" x="'+x(index)+'" y="'+valueY+'" text-anchor="middle">'+group.rate.toFixed(1)+'%</text><text class="trend-label" x="'+x(index)+'" y="'+(height-34)+'" text-anchor="middle">'+escapeHTML(group.year)+'</text><text class="trend-label" x="'+x(index)+'" y="'+(height-19)+'" text-anchor="middle">'+escapeHTML(group.semester)+'</text></g>';
  });
  target.innerHTML=svg+'</svg>';
}

function renderYearChart() {
  const averageMode=$('yearChartMetric').value==='average';
  $('yearChartLegend').textContent=averageMode?'Average grade · lower is better':'Passing rate (%)';
  if(!filteredRecords.length) {$('passingChart').innerHTML='<div class="no-data">No records match these filters.</div>';return;}
  const years=unique(filteredRecords,'Year_Level'),width=540,height=202,left=35,top=22,plotHeight=139,plotWidth=483,max=averageMode?5:100;
  let svg=`<svg class="year-chart" viewBox="0 0 ${width} ${height}" role="group" aria-label="${averageMode?'Average grade':'Passing rate'} by year level">`;
  for(let i=0;i<=4;i++) {
    const y=top+plotHeight-plotHeight*i/4;
    svg+=`<line class="grid-line" x1="${left}" x2="${width-10}" y1="${y}" y2="${y}"/><text x="${left-9}" y="${y+4}" text-anchor="end">${averageMode?(max*i/4).toFixed(1):`${max*i/4}%`}</text>`;
  }
  years.forEach((year,i) => {
    const group=validGrades(filteredRecords.filter(row => row.Year_Level===year));
    const value=averageMode?mean(group.map(row => Number(row.Final_Grade))):pct(group.filter(passed).length,group.length);
    const step=plotWidth/years.length,barWidth=Math.min(49,step*.4),x=left+step*(i+.5)-barWidth/2,barHeight=value/max*plotHeight,y=top+plotHeight-barHeight;
    const label=averageMode?value.toFixed(2):`${value.toFixed(1)}%`;
    const selected=$('yearFilter').value===year;
    svg+=`<g class="chart-column ${selected?'is-selected':''}" tabindex="0" role="button" aria-pressed="${selected}" data-year="${escapeHTML(year)}" data-tooltip="${escapeHTML(`Year ${year} · ${label}\n${group.length} records · ${group.filter(passed).length} passed\nClick to ${selected?'clear this year':'filter the dashboard'}`)}" aria-label="Year ${escapeHTML(year)}: ${label}. ${selected?'Clear year filter.':'Filter to this year.'}"><rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${Math.max(1,barHeight)}" rx="3"/><text class="bar-label" x="${x+barWidth/2}" y="${y-9}" text-anchor="middle">${label}</text><text x="${x+barWidth/2}" y="${top+plotHeight+24}" text-anchor="middle">Year ${escapeHTML(year)}</text></g>`;
  });
  $('passingChart').innerHTML=svg+'</svg>';
}

function renderSubjects() {
  if(!$('subjectChart')) return;
  const subjects=unique(filteredRecords,'Subject_Name').map(subject => {
    const group=validGrades(filteredRecords.filter(row => row.Subject_Name===subject));
    return {subject,average:mean(group.map(row => Number(row.Final_Grade)))};
  }).sort((a,b) => b.average-a.average);
  $('subjectBadge').textContent=`${subjects.length} subjects`;
  $('subjectChart').innerHTML=subjects.length?subjects.map(item => {
    const group=filteredRecords.filter(row => row.Subject_Name===item.subject),selected=$('subjectFilter').value===item.subject;
    return `<button class="subject-row ${selected?'is-selected':''}" aria-pressed="${selected}" data-subject="${escapeHTML(item.subject)}" data-tooltip="${escapeHTML(`${item.subject}\nAverage grade: ${format(item.average)} · ${pct(group.filter(passed).length,group.length).toFixed(1)}% passing\n${group.length} records · Click to ${selected?'clear subject filter':'filter the dashboard'}`)}"><span class="subject-name">${escapeHTML(item.subject)}</span><span class="subject-bar-track"><span class="subject-bar" style="width:${item.average/5*100}%"></span></span><strong class="subject-value">${format(item.average)}</strong></button>`;
  }).join(''):'<div class="no-data">No subjects match these filters.</div>';
  const selectedSubject=$('subjectFilter').value, detail=$('subjectDetail');
  if(detail&&selectedSubject!=='all'){
    const group=validGrades(filteredRecords.filter(row=>row.Subject_Name===selectedSubject)), evaluations=submitted(filteredRecords.filter(row=>row.Subject_Name===selectedSubject)), eligible=filteredRecords.filter(row=>row.Subject_Name===selectedSubject&&row.SETE_Eligible==='Yes').length, atRiskCount=group.filter(atRisk).length, failedCount=group.filter(failedRecord).length, average=mean(group.map(row=>Number(row.Final_Grade))), sete=mean(evaluations.map(row=>Number(row.SETE_Average_Rating)));
    const concern=failedCount?`${failedCount} failed grade record${failedCount===1?'':'s'} require review.`:atRiskCount?`${atRiskCount} borderline passing record${atRiskCount===1?'':'s'} may benefit from monitoring.`:'No current grade concerns in this selection.';
    detail.hidden=false; detail.innerHTML=`<strong>${escapeHTML(selectedSubject)}</strong><div class="subject-detail-grid"><span><b>${group.length}</b> valid records</span><span><b>${pct(group.filter(onTrack).length,group.length).toFixed(1)}%</b> on-track</span><span><b>${atRiskCount}</b> at risk</span><span><b>${failedCount}</b> failed</span><span><b>${format(average)}</b> average grade</span><span><b>${format(sete)}</b> SETE · ${eligible?`${pct(evaluations.length,eligible).toFixed(1)}% response`:'No eligible evaluations'}</span></div><small>${escapeHTML(concern)} Faculty action: review the records and coordinate appropriate academic support.</small>`;
  } else if(detail) { detail.hidden=true; detail.innerHTML=''; }
}

function renderTeaching() {
  if(!$('teachingChart')) return;
  const evaluations=submitted(filteredRecords),eligible=filteredRecords.filter(row => row.SETE_Eligible==='Yes');
  const dimensions=[['Subject knowledge','SETE_Subject_Knowledge'],['Teaching delivery','SETE_Teaching_Delivery'],['Student engagement','SETE_Student_Engagement'],['Assessment & feedback','SETE_Assessment_Feedback']];
  $('teachingChart').innerHTML=evaluations.length?dimensions.map(([label,key]) => {
    const avg=mean(evaluations.filter(row => numeric(row[key])).map(row => Number(row[key])));
    return `<button type="button" class="teaching-row ${selectedDimension===key?'is-selected':''}" aria-pressed="${selectedDimension===key}" data-dimension="${key}" data-tooltip="${escapeHTML(`${label}\n${format(avg)} out of 5 · ${evaluations.length} submitted evaluations\nClick for the rating breakdown`)}"><span class="teaching-row-label"><span>${label}</span><strong>${format(avg)} <span class="muted">/ 5</span></strong></span><span class="teaching-track" aria-hidden="true"><span style="width:${avg/5*100}%"></span></span></button>`;
  }).join(''):'<div class="no-data">No submitted evaluations in this selection.</div>';
  const paired=evaluations.filter(row => numeric(row.SETE_Previous_Semester_Avg));
  const change=mean(paired.map(row => Number(row.SETE_Average_Rating)-Number(row.SETE_Previous_Semester_Avg)));
  $('teachingResponse').textContent=eligible.length?`${pct(evaluations.length,eligible.length).toFixed(1)}%`:'—';
  $('teachingChange').textContent=change==null?'—':`${change>=0?'+':''}${change.toFixed(2)} pts`;
  $('evaluationCount').textContent=`${evaluations.length} of ${eligible.length} eligible records`;
  const chosen=dimensions.find(([,key]) => key===selectedDimension);
  $('teachingDetail').hidden=!chosen;
  if(chosen) {
    const values=evaluations.map(row => Number(row[chosen[1]]));
    $('teachingDetail').textContent=values.length?`${chosen[0]}: average ${format(mean(values))}/5 across ${values.length} evaluations. ${values.filter(value=>value>=4).length} ratings of 4 or 5; ${values.filter(value=>value<4).length} below 4. Click the dimension again to close.`:'No submitted evaluations for this dimension in the current selection.';
  }
}

function sectionRiskGroups() {
  const periodGroups=new Map();
  filteredRecords.forEach(row=>{
    const key=[row.Faculty_ID,row.Assignment_ID,row.Subject_Code,row.Subject_Name,row.Section,row.Academic_Year,row.Semester].join('|');
    if(!periodGroups.has(key))periodGroups.set(key,{assignmentId:row.Assignment_ID,subjectCode:row.Subject_Code,subject:row.Subject_Name,section:row.Section,year:row.Academic_Year,semester:row.Semester,rows:[]});
    periodGroups.get(key).rows.push(row);
  });
  const sectionData=[...periodGroups.values()].map(group=>{
    const grades=validGrades(group.rows),predictions=group.rows.filter(row=>numeric(row.Prediction_Score)&&row.Prediction_Level),onTrackCount=grades.filter(onTrack).length,atRiskCount=grades.filter(atRisk).length,failedCount=grades.filter(failedRecord).length;
    const predictionCounts={high:predictions.filter(row=>row.Prediction_Level==='High Failure Risk').length,moderate:predictions.filter(row=>row.Prediction_Level==='Moderate Failure Risk').length,low:predictions.filter(row=>row.Prediction_Level==='Low Failure Risk').length},predictionAverage=mean(predictions.map(row=>Number(row.Prediction_Score)));
    const onTrackRate=pct(onTrackCount,grades.length),atRiskRate=pct(atRiskCount,grades.length),failedRate=pct(failedCount,grades.length),attentionRate=pct(atRiskCount+failedCount,grades.length);
    const risk=failedRate>=10||attentionRate>=30?'High':failedCount||atRiskRate>=20?'Moderate':'Low';
    const explanation=failedCount?`${failedCount} recorded failing grade${failedCount===1?' indicates':'s indicate'} a need for academic review.`:atRiskCount?`${atRiskCount} borderline passing grade${atRiskCount===1?' was':'s were'} identified in this section.`:'Most grade records are within the On-Track classification.';
    const action=failedCount?'Review remediation and academic consultation opportunities.':atRiskCount?'Monitor borderline passing outcomes and consider additional consultation sessions.':'Continue monitoring satisfactory subject performance.';
    return {assignmentId:group.assignmentId,subjectCode:group.subjectCode,subject:group.subject,section:group.section,year:group.year,semester:group.semester,grades,predictions,predictionCounts,predictionAverage,onTrackCount,atRiskCount,failedCount,onTrackRate,atRiskRate,failedRate,risk,explanation,action,average:mean(grades.map(row=>Number(row.Final_Grade)))};
  });
  const subjects=new Map();
  sectionData.forEach(section=>{
    if(!subjects.has(section.subject))subjects.set(section.subject,[]);
    subjects.get(section.subject).push(section);
  });
  return [...subjects.entries()].map(([subject,sections])=>{
    const grades=sections.reduce((all,section)=>all.concat(section.grades),[]),predictions=sections.reduce((all,section)=>all.concat(section.predictions),[]),onTrackCount=grades.filter(onTrack).length,atRiskCount=grades.filter(atRisk).length,failedCount=grades.filter(failedRecord).length;
    const predictionCounts={high:predictions.filter(row=>row.Prediction_Level==='High Failure Risk').length,moderate:predictions.filter(row=>row.Prediction_Level==='Moderate Failure Risk').length,low:predictions.filter(row=>row.Prediction_Level==='Low Failure Risk').length},predictionAverage=mean(predictions.map(row=>Number(row.Prediction_Score)));
    const onTrackRate=pct(onTrackCount,grades.length),atRiskRate=pct(atRiskCount,grades.length),failedRate=pct(failedCount,grades.length),attentionRate=pct(atRiskCount+failedCount,grades.length);
    const risk=failedRate>=10||attentionRate>=30?'High':failedCount||atRiskRate>=20?'Moderate':'Low';
    return {subject,sections,sectionCount:new Set(sections.map(section=>section.section)).size,grades,predictions,predictionCounts,predictionAverage,onTrackCount,atRiskCount,failedCount,onTrackRate,atRiskRate,failedRate,risk,average:mean(grades.map(row=>Number(row.Final_Grade)))};
  }).sort((a,b)=>a.subject.localeCompare(b.subject));
}
function renderSectionRisk() {
  const target=$('sectionRiskList'); if(!target)return;
  const groups=sectionRiskGroups();
  target.innerHTML=groups.length?groups.map((group,index)=>'<article class="section-risk-card"><div class="section-risk-card-head"><div><h3>'+escapeHTML(group.subject)+'</h3><p>'+group.sectionCount+' assigned section'+(group.sectionCount===1?'':'s')+' · '+group.grades.length+' valid grade records</p></div><span class="risk-level '+group.risk.toLowerCase()+'">'+group.risk+' Risk</span></div><div class="section-risk-subject-sections">'+group.sections.map(section=>escapeHTML(section.section)).filter((section,index,array)=>array.indexOf(section)===index).join(' · ')+'</div><div class="section-risk-card-summary"><span>On-Track <strong>'+group.onTrackRate.toFixed(1)+'%</strong></span><span>At Risk <strong>'+group.atRiskRate.toFixed(1)+'%</strong></span><span>Failed <strong>'+group.failedRate.toFixed(1)+'%</strong></span></div><button class="section-details-button" type="button" data-section-risk-index="'+index+'">View Sections</button></article>').join(''):'<div class="section-risk-empty">No section academic data available for the selected filters.</div>';
  target.querySelectorAll('[data-section-risk-index]').forEach(function(button){ button.addEventListener('click',function(){ openSectionRiskModal(groups[Number(button.dataset.sectionRiskIndex)]); }); });
}
function openSectionRiskModal(group) {
  const modal=$('sectionRiskModal');
  $('sectionRiskModalTitle').textContent=group.subject+' — Sections';
  $('sectionRiskModalBody').innerHTML='<p class="section-risk-modal-context">Each section and academic period is calculated independently. Monitoring thresholds: High = failed rate ≥10% or at-risk plus failed rate ≥30%; Moderate = any failed record or at-risk rate ≥20%; otherwise Low.</p><div class="section-risk-modal-sections">'+group.sections.map(section=>'<article class="section-risk-modal-section"><div class="section-risk-card-head"><div><h3>'+escapeHTML(section.section)+'</h3><p>'+escapeHTML(section.year)+' · '+escapeHTML(section.semester)+'</p></div><span class="risk-level '+section.risk.toLowerCase()+'">'+section.risk+' Risk</span></div><div class="section-risk-detail-grid"><span>Total valid grade records<strong>'+section.grades.length+'</strong></span><span>On-Track<strong>'+section.onTrackCount+' ('+section.onTrackRate.toFixed(1)+'%)</strong></span><span>At-Risk / Grade 3.00<strong>'+section.atRiskCount+' ('+section.atRiskRate.toFixed(1)+'%)</strong></span><span>Failed / Grade 5.00<strong>'+section.failedCount+' ('+section.failedRate.toFixed(1)+'%)</strong></span></div><p><strong>Academic interpretation:</strong> '+escapeHTML(section.explanation)+'</p><p><strong>Suggested faculty action:</strong> '+escapeHTML(section.action)+'</p></article>').join('')+'</div>';
  modal.hidden=false; $('sectionRiskOverlay').hidden=false; document.body.classList.add('drawer-open'); $('sectionRiskModalClose').focus();
}
function renderSectionRisk() {
  const target=$('sectionRiskList'); if(!target)return;
  const groups=sectionRiskGroups();
  const heading=document.querySelector('#sectionRisk .section-risk-heading p');
  if(heading)heading.textContent=groups.length+' subject'+(groups.length===1?' is':'s are')+' handled by Sir Joseph. Select a subject to view its sections and SETE evaluation results.';
  const predictionStatus=document.querySelector('#sectionRisk .prediction-status');
  if(predictionStatus){predictionStatus.textContent=predictionLoadMessage;predictionStatus.classList.toggle('is-error',predictionByRecordId.size===0);}
  target.innerHTML=groups.length?groups.map((group,index)=>{
    const sections=[...new Set(group.sections.map(section=>section.section))];
    return '<article class="section-risk-subject-card"><div class="section-risk-subject-main"><h3>'+escapeHTML(group.subject)+'</h3><p>'+group.sectionCount+' assigned section'+(group.sectionCount===1?'':'s')+' · '+group.grades.length+' valid grade records</p><div class="section-risk-section-buttons">'+sections.map(section=>'<button type="button" class="section-risk-section-button" data-section-risk-subject="'+index+'" data-section-risk-section="'+encodeURIComponent(section)+'">'+escapeHTML(section)+'</button>').join('')+'</div></div><span class="risk-level '+group.risk.toLowerCase()+'">'+group.risk+' Risk</span></article>';
  }).join(''):'<div class="section-risk-empty">No section academic data available for the selected filters.</div>';
  target.querySelectorAll('.section-risk-subject-card').forEach((card,index)=>{const group=groups[index];const summary=document.createElement('div');summary.className='section-risk-prediction-summary';summary.innerHTML='<span>Historical ML predictions <strong>'+group.predictions.length+'/'+group.grades.length+'</strong></span><span>Average score <strong>'+ (group.predictionAverage==null?'—':group.predictionAverage.toFixed(1)+'%')+'</strong></span><span>High / Moderate / Low <strong>'+group.predictionCounts.high+' / '+group.predictionCounts.moderate+' / '+group.predictionCounts.low+'</strong></span>';card.querySelector('.section-risk-section-buttons').before(summary);});
  target.querySelectorAll('[data-section-risk-section]').forEach(function(button){
    button.addEventListener('click',function(){
      const group=groups[Number(button.dataset.sectionRiskSubject)];
      const section=decodeURIComponent(button.dataset.sectionRiskSection);
      openSectionRiskModal(group.subject,group.sections.filter(item=>item.section===section));
    });
  });
}
function openSectionRiskModal(subject,sections) {
  const modal=$('sectionRiskModal'),sectionName=sections.length?sections[0].section:'Section details';
  predictionBackState=null;
  const backButton=$('predictionBackButton'); if(backButton){backButton.hidden=true;backButton.onclick=null;}
  $('sectionRiskModalTitle').textContent=subject+' — '+sectionName;
  $('sectionRiskModalBody').innerHTML='<div class="section-risk-period-tabs" role="tablist" aria-label="Academic periods">'+sections.map((section,index)=>'<button type="button" class="section-risk-period-tab'+(index===0?' active':'')+'" data-section-risk-period="'+index+'" role="tab" aria-selected="'+(index===0?'true':'false')+'">'+escapeHTML(section.year)+' · '+escapeHTML(section.semester)+'</button>').join('')+'</div><div class="section-risk-modal-sections">'+sections.map((section,index)=>{
    const eligible=section.grades.filter(row=>row.SETE_Eligible==='Yes').length,evaluations=submitted(section.grades),responseRate=pct(evaluations.length,eligible),seteAverage=mean(evaluations.map(row=>Number(row.SETE_Average_Rating)));
    const attentionRows=[...new Map(section.grades.filter(row=>atRisk(row)||failedRecord(row)).map(row=>[row.Record_ID||[row.Student_ID,row.Section,row.Academic_Year,row.Semester,row.Final_Grade].join('|'),row])).values()];
    const attentionMarkup=attentionRows.length?'<div class="section-risk-attention"><h3>Students Requiring Attention</h3><p>Students classified by current academic risk status.</p><ul>'+attentionRows.map(row=>'<li><strong>'+escapeHTML(row.Student_ID)+'</strong><span class="risk-pill '+(failedRecord(row)?'high':'moderate')+'">'+(failedRecord(row)?'Failed — Risk of Repeating the Subject':'At Risk / Borderline Passed')+'</span><small>Grade '+Number(row.Final_Grade).toFixed(2)+'</small></li>').join('')+'</ul></div>':'<div class="section-risk-attention"><h3>Students Requiring Attention</h3><p>No grade 3.00 or 5.00 records were found for this section and academic period.</p></div>';
    const seteMarkup=evaluations.length?'<div class="section-risk-sete"><h3>SETE Evaluation</h3><div class="section-risk-detail-grid"><span>Eligible records<strong>'+eligible+'</strong></span><span>Submitted evaluations<strong>'+evaluations.length+' ('+responseRate.toFixed(1)+'%)</strong></span><span>Average SETE rating<strong>'+format(seteAverage)+' / 5</strong></span></div><p>Evaluation results are shown for this section and academic period only.</p></div>':'<div class="section-risk-sete"><h3>SETE Evaluation</h3><p>No submitted SETE evaluations are available for this section and academic period.</p></div>';
    return '<article class="section-risk-modal-section" data-section-risk-period-panel="'+index+'"'+(index===0?'':' hidden')+'><div class="section-risk-modal-section-label">SECTION: '+escapeHTML(section.section)+'</div><h3>Section Information</h3><p><strong>Subject:</strong> '+escapeHTML(section.subject)+'</p><p><strong>Section:</strong> '+escapeHTML(section.section)+'</p><p><strong>Academic period:</strong> '+escapeHTML(section.year)+' · '+escapeHTML(section.semester)+'</p><p><strong>Faculty:</strong> Joseph Bautista</p><h3>Academic Performance</h3><div class="section-risk-detail-grid"><span>Total valid grade records<strong>'+section.grades.length+'</strong></span><span>On-Track<strong>'+section.onTrackCount+' ('+section.onTrackRate.toFixed(1)+'%)</strong></span><span>At-Risk / Grade 3.00<strong>'+section.atRiskCount+' ('+section.atRiskRate.toFixed(1)+'%)</strong></span><span>Failed / Grade 5.00<strong>'+section.failedCount+' ('+section.failedRate.toFixed(1)+'%)</strong></span><span>Average grade<strong>'+format(section.average)+'</strong></span><span>Risk level<strong>'+section.risk+' Risk</strong></span></div><h3>Academic Risk Assessment</h3><p>'+escapeHTML(section.explanation)+'</p><h3>Recommended Faculty Action</h3><p>'+escapeHTML(section.action)+'</p>'+attentionMarkup+seteMarkup+'</article>';
  }).join('')+'</div><p class="section-risk-modal-context">Monitoring rules: High = failed rate ≥10% or at-risk plus failed rate ≥30%; Moderate = any failed record or at-risk rate ≥20%; otherwise Low.</p>';
  $('sectionRiskModalBody').querySelectorAll('.section-risk-modal-section').forEach((panel,index)=>{const section=sections[index],box=document.createElement('div');box.className='section-risk-predictions';box.innerHTML='<h3>Historical Risk Simulation</h3><p>Model-generated screening estimates from the matched prediction CSV; scores are not guaranteed probabilities of failure.</p><div class="section-risk-detail-grid"><span>Matched predictions<strong>'+section.predictions.length+' / '+section.grades.length+'</strong></span><span>Average risk score<strong>'+ (section.predictionAverage==null?'—':section.predictionAverage.toFixed(1)+'%')+'</strong></span><span>High Failure Risk<strong>'+section.predictionCounts.high+'</strong></span><span>Moderate Failure Risk<strong>'+section.predictionCounts.moderate+'</strong></span><span>Low Failure Risk<strong>'+section.predictionCounts.low+'</strong></span></div>'+(section.predictions.length?'<ul>'+section.predictions.map(row=>'<li><strong>'+escapeHTML(row.Student_ID)+'</strong><span class="risk-pill '+(row.Prediction_Level==='High Failure Risk'?'high':row.Prediction_Level==='Moderate Failure Risk'?'moderate':'low')+'">'+escapeHTML(row.Prediction_Level)+'</span><small>'+Number(row.Prediction_Score).toFixed(1)+'% score</small></li>').join('')+'</ul>':'<p>No matched prediction records are available for this filtered section.</p>');panel.appendChild(box);});
  $('sectionRiskModalBody').querySelectorAll('[data-section-risk-period]').forEach(tab=>tab.addEventListener('click',function(){
    const selected=Number(tab.dataset.sectionRiskPeriod);
    $('sectionRiskModalBody').querySelectorAll('[data-section-risk-period]').forEach(item=>{const active=Number(item.dataset.sectionRiskPeriod)===selected;item.classList.toggle('active',active);item.setAttribute('aria-selected',active?'true':'false');});
    $('sectionRiskModalBody').querySelectorAll('[data-section-risk-period-panel]').forEach(panel=>{panel.hidden=Number(panel.dataset.sectionRiskPeriodPanel)!==selected;});
  }));
  modal.hidden=false; $('sectionRiskOverlay').hidden=false; document.body.classList.add('drawer-open'); $('sectionRiskModalClose').focus();
}
function predictionRows() {
  const priority={'High Failure Risk':3,'Moderate Failure Risk':2,'Low Failure Risk':1};
  return filteredRecords.filter(row=>numeric(row.Prediction_Score)&&row.Prediction_Level).sort((a,b)=>priority[b.Prediction_Level]-priority[a.Prediction_Level]||((Number(b.Prediction_Score)-Number(a.Prediction_Score))*(-predictionSortDirection)));
}
function renderSectionRisk() {
  const target=$('sectionRiskList'); if(!target)return;
  const rows=predictionRows().filter(row=>predictionRiskFilter==='all'||row.Prediction_Level===predictionRiskFilter+' Failure Risk').filter(row=>!predictionSearch||row.Student_ID.toLowerCase().includes(predictionSearch));
  const pages=Math.max(1,Math.ceil(rows.length/predictionPageSize)); predictionPage=Math.min(predictionPage,pages); const start=(predictionPage-1)*predictionPageSize,visible=rows.slice(start,start+predictionPageSize);
  target.innerHTML='<div class="prediction-toolbar"><label class="prediction-search"><span data-icon="search"></span><input id="predictionStudentSearch" type="search" placeholder="Search Student ID" aria-label="Search predicted student ID" value="'+escapeHTML(predictionSearch)+'"></label><label class="prediction-filter-label">Risk level<select id="predictionRiskFilter" class="compact-select" aria-label="Filter predicted risk level"><option value="all"'+(predictionRiskFilter==='all'?' selected':'')+'>All levels</option><option value="High"'+(predictionRiskFilter==='High'?' selected':'')+'>High Failure Risk</option><option value="Moderate"'+(predictionRiskFilter==='Moderate'?' selected':'')+'>Moderate Failure Risk</option><option value="Low"'+(predictionRiskFilter==='Low'?' selected':'')+'>Low Failure Risk</option></select></label><button type="button" class="prediction-sort-button" id="predictionSortButton">Sort score '+(predictionSortDirection===-1?'↓':'↑')+'</button></div><div class="prediction-table-wrap"><table class="prediction-table"><thead><tr><th>Student ID</th><th>Subject</th><th>Section</th><th>Academic period</th><th>Risk level</th><th><button type="button" id="predictionSortHeader">Risk score ↕</button></th></tr></thead><tbody>'+(visible.length?visible.map(row=>'<tr tabindex="0" role="button" data-prediction-record="'+escapeHTML(row.Record_ID)+'"><td><strong>'+escapeHTML(row.Student_ID)+'</strong></td><td>'+escapeHTML(row.Subject_Name)+'</td><td>'+escapeHTML(row.Section)+'</td><td>'+escapeHTML(row.Academic_Year)+' · '+escapeHTML(row.Semester)+'</td><td><span class="prediction-level '+(row.Prediction_Level==='High Failure Risk'?'high':row.Prediction_Level==='Moderate Failure Risk'?'moderate':'low')+'">'+escapeHTML(row.Prediction_Level)+'</span></td><td><strong>'+Number(row.Prediction_Score).toFixed(1)+'%</strong></td></tr>').join(''):'<tr><td colspan="6" class="empty-state">No prediction records match the current filters.</td></tr>')+'</tbody></table></div><div class="prediction-table-footer"><span>Showing '+(rows.length?start+1:0)+'–'+Math.min(start+predictionPageSize,rows.length)+' of '+rows.length+' predicted students</span><div><button type="button" class="pagination-button" id="predictionPrevious" aria-label="Previous prediction page"'+(predictionPage===1?' disabled':'')+'>‹</button><span>Page '+predictionPage+' of '+pages+'</span><button type="button" class="pagination-button" id="predictionNext" aria-label="Next prediction page"'+(predictionPage===pages?' disabled':'')+'>›</button></div></div>';
  document.querySelectorAll('#sectionRisk [data-icon]').forEach(node=>{node.innerHTML='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+(iconPaths[node.dataset.icon]||'')+'</svg>';});
  $('predictionRiskFilter').addEventListener('change',event=>{predictionRiskFilter=event.target.value;predictionPage=1;renderSectionRisk();}); $('predictionStudentSearch').addEventListener('input',event=>{predictionSearch=event.target.value.trim().toLowerCase();predictionPage=1;renderSectionRisk();});
  const sort=()=>{predictionSortDirection*=-1;renderSectionRisk();}; $('predictionSortButton').addEventListener('click',sort); $('predictionSortHeader').addEventListener('click',sort); $('predictionPrevious').addEventListener('click',()=>{predictionPage--;renderSectionRisk();}); $('predictionNext').addEventListener('click',()=>{predictionPage++;renderSectionRisk();});
  target.querySelectorAll('[data-prediction-record]').forEach(row=>{const open=()=>openPredictionModal(filteredRecords.find(item=>item.Record_ID===row.dataset.predictionRecord),{restore:()=>renderSectionRisk(),scrollY:window.scrollY});row.addEventListener('click',open);row.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});});
}
function openPredictionModal(row) { if(!row)return; $('sectionRiskModalTitle').textContent='Prediction details'; $('sectionRiskModalBody').innerHTML='<div class="prediction-detail-head"><span class="prediction-level '+(row.Prediction_Level==='High Failure Risk'?'high':row.Prediction_Level==='Moderate Failure Risk'?'moderate':'low')+'">'+escapeHTML(row.Prediction_Level)+'</span><strong>'+Number(row.Prediction_Score).toFixed(1)+'% risk score</strong></div><div class="section-risk-detail-grid"><span>Student ID<strong>'+escapeHTML(row.Student_ID)+'</strong></span><span>Subject<strong>'+escapeHTML(row.Subject_Name)+'</strong></span><span>Section<strong>'+escapeHTML(row.Section)+'</strong></span><span>Academic period<strong>'+escapeHTML(row.Academic_Year)+' · '+escapeHTML(row.Semester)+'</strong></span></div><p class="prediction-detail-note">This model estimates which students may be at risk of failing based on historical academic patterns. Use this result to prioritize faculty attention and early support.</p>'; $('sectionRiskModal').hidden=false; $('sectionRiskOverlay').hidden=false; document.body.classList.add('drawer-open'); $('sectionRiskModalClose').focus(); }
function closeSectionRiskModal() { if(!$('sectionRiskModal'))return; $('sectionRiskModal').hidden=true; $('sectionRiskOverlay').hidden=true; if(!$('kpiDrawer')||$('kpiDrawer').hidden)document.body.classList.remove('drawer-open'); }
function renderSectionRisk() {
  const target=$('sectionRiskList'); if(!target)return;
  const baseRows=predictionRows(),highStudents=new Set(baseRows.filter(row=>row.Prediction_Level==='High Failure Risk').map(row=>row.Student_ID)).size;
  const counts={High:baseRows.filter(row=>row.Prediction_Level==='High Failure Risk').length,Moderate:baseRows.filter(row=>row.Prediction_Level==='Moderate Failure Risk').length,Low:baseRows.filter(row=>row.Prediction_Level==='Low Failure Risk').length};
  const rows=baseRows.filter(row=>predictionRiskFilter==='all'||row.Prediction_Level===predictionRiskFilter+' Failure Risk').filter(row=>!predictionSearch||row.Student_ID.toLowerCase().includes(predictionSearch));
  const pages=Math.max(1,Math.ceil(rows.length/predictionPageSize)); predictionPage=Math.min(predictionPage,pages); const start=(predictionPage-1)*predictionPageSize,visible=rows.slice(start,start+predictionPageSize);
  const chip=(key,label)=>'<button type="button" class="prediction-filter-chip '+(predictionRiskFilter===key?'active ':'')+'risk-'+key.toLowerCase()+'" data-prediction-filter="'+key+'"><span>'+label+'</span><strong>'+counts[key]+'</strong></button>';
  const alert=highStudents?'<div class="academic-risk-alert"><span class="prediction-alert-icon" aria-hidden="true">!</span><div><strong>Academic Risk Alert</strong><p>'+highStudents+' student'+(highStudents===1?' is':'s are')+' currently flagged as High Failure Risk. Review these records and consider early academic support.</p></div><button type="button" class="prediction-alert-action" id="viewHighRisk">View High-Risk Students</button></div>':'<div class="academic-risk-alert neutral"><span class="prediction-alert-icon" aria-hidden="true">i</span><div><strong>No high-risk students in this view</strong><p>Continue monitoring the current filtered records and provide support where needed.</p></div></div>';
  target.innerHTML=alert+'<div class="prediction-toolbar"><label class="prediction-search"><span data-icon="search"></span><input id="predictionStudentSearch" type="search" placeholder="Search Student ID" aria-label="Search predicted student ID" value="'+escapeHTML(predictionSearch)+'"></label><div class="prediction-filter-chips" aria-label="Filter predictions by risk level">'+chip('High','High')+chip('Moderate','Moderate')+chip('Low','Low')+'</div><button type="button" class="prediction-sort-button" id="predictionSortButton">Score '+(predictionSortDirection===-1?'↓':'↑')+'</button><button type="button" class="prediction-reset-button" id="predictionResetButton">Reset</button></div><div class="prediction-table-wrap"><table class="prediction-table"><thead><tr><th>Student ID</th><th>Subject</th><th>Section</th><th>Academic period</th><th>Risk level</th><th><button type="button" id="predictionSortHeader">Risk score ↕</button></th></tr></thead><tbody>'+(visible.length?visible.map(row=>'<tr tabindex="0" role="button" data-prediction-record="'+escapeHTML(row.Record_ID)+'"><td><strong>'+escapeHTML(row.Student_ID)+'</strong></td><td>'+escapeHTML(row.Subject_Name)+'</td><td>'+escapeHTML(row.Section)+'</td><td>'+escapeHTML(row.Academic_Year)+' · '+escapeHTML(row.Semester)+'</td><td><span class="prediction-level '+(row.Prediction_Level==='High Failure Risk'?'high':row.Prediction_Level==='Moderate Failure Risk'?'moderate':'low')+'">'+escapeHTML(row.Prediction_Level)+'</span></td><td><strong>'+Number(row.Prediction_Score).toFixed(1)+'%</strong></td></tr>').join(''):'<tr><td colspan="6" class="empty-state">No prediction records match the current filters.</td></tr>')+'</tbody></table></div><div class="prediction-table-footer"><span>Showing '+(rows.length?start+1:0)+'–'+Math.min(start+predictionPageSize,rows.length)+' of '+rows.length+' predicted students</span><div><button type="button" class="pagination-button" id="predictionPrevious" aria-label="Previous prediction page"'+(predictionPage===1?' disabled':'')+'>‹</button><span>Page '+predictionPage+' of '+pages+'</span><button type="button" class="pagination-button" id="predictionNext" aria-label="Next prediction page"'+(predictionPage===pages?' disabled':'')+'>›</button></div></div>';
  document.querySelectorAll('#sectionRisk [data-icon]').forEach(node=>{node.innerHTML='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+(iconPaths[node.dataset.icon]||'')+'</svg>';});
  target.querySelectorAll('[data-prediction-filter]').forEach(button=>button.addEventListener('click',()=>{predictionRiskFilter=button.dataset.predictionFilter;predictionPage=1;renderSectionRisk();}));
  $('viewHighRisk')?.addEventListener('click',()=>{predictionRiskFilter='High';predictionSearch='';predictionPage=1;renderSectionRisk();});
  $('predictionStudentSearch').addEventListener('input',event=>{predictionSearch=event.target.value.trim().toLowerCase();predictionPage=1;renderSectionRisk();});
  const sort=()=>{predictionSortDirection*=-1;predictionPage=1;renderSectionRisk();}; $('predictionSortButton').addEventListener('click',sort); $('predictionSortHeader').addEventListener('click',sort);
  $('predictionResetButton').addEventListener('click',()=>{predictionRiskFilter='all';predictionSearch='';predictionSortDirection=-1;predictionPage=1;renderSectionRisk();}); $('predictionPrevious').addEventListener('click',()=>{predictionPage--;renderSectionRisk();}); $('predictionNext').addEventListener('click',()=>{predictionPage++;renderSectionRisk();});
  target.querySelectorAll('[data-prediction-record]').forEach(row=>{const open=()=>openPredictionModal(filteredRecords.find(item=>item.Record_ID===row.dataset.predictionRecord),{restore:()=>renderSectionRisk(),scrollY:window.scrollY});row.addEventListener('click',open);row.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});});
}
function predictionIntervention(row) {
  const recommendations=[];
  if(numeric(row.Attendance_Pct)&&Number(row.Attendance_Pct)<75) recommendations.push('attendance follow-up');
  if(numeric(row.Quiz_Average)&&Number(row.Quiz_Average)<75) recommendations.push('quiz and assessment support');
  if(numeric(row.Midterm_Score)&&Number(row.Midterm_Score)<75) recommendations.push('midterm remediation or tutoring');
  return recommendations.length?'Prioritize '+recommendations.join(', ')+' based on the recorded indicators.':'Continue regular monitoring and provide timely feedback before the next assessment.';
}
function openPredictionModal(row, backState) {
  if(!row)return;
  predictionBackState=backState||null;
  $('sectionRiskModalTitle').textContent='Prediction details';
  const backButton=$('predictionBackButton');
  if(backButton){
    backButton.hidden=!backState;
    backButton.onclick=backState?()=>{
      const restore=predictionBackState.restore,scrollY=predictionBackState.scrollY;
      predictionBackState=null;
      closeSectionRiskModal();
      restore();
      requestAnimationFrame(()=>window.scrollTo({top:scrollY,behavior:'auto'}));
    }:null;
  }
  $('sectionRiskModalBody').innerHTML='<div class="prediction-detail-head"><span class="prediction-level '+(row.Prediction_Level==='High Failure Risk'?'high':row.Prediction_Level==='Moderate Failure Risk'?'moderate':'low')+'">'+escapeHTML(row.Prediction_Level)+'</span><strong>'+Number(row.Prediction_Score).toFixed(1)+'% risk score</strong></div><div class="section-risk-detail-grid"><span>Student ID<strong>'+escapeHTML(row.Student_ID)+'</strong></span><span>Subject<strong>'+escapeHTML(row.Subject_Name)+'</strong></span><span>Section<strong>'+escapeHTML(row.Section)+'</strong></span><span>Academic period<strong>'+escapeHTML(row.Academic_Year)+' · '+escapeHTML(row.Semester)+'</strong></span><span>Attendance<strong>'+Number(row.Attendance_Pct).toFixed(1)+'%</strong></span><span>Quiz average<strong>'+Number(row.Quiz_Average).toFixed(1)+'%</strong></span><span>Midterm score<strong>'+Number(row.Midterm_Score).toFixed(1)+'%</strong></span><span>Model risk score<strong>'+Number(row.Prediction_Score).toFixed(1)+'%</strong></span></div><div class="prediction-intervention"><h3>Recommended academic intervention</h3><p>'+escapeHTML(predictionIntervention(row))+'</p></div><p class="prediction-detail-note">This model estimates which students may be at risk of failing based on historical academic patterns. Use this result to prioritize faculty attention and early support.</p>';
  $('sectionRiskModal').hidden=false; $('sectionRiskOverlay').hidden=false; document.body.classList.add('drawer-open'); (backState?backButton:$('sectionRiskModalClose')).focus();
}
function legacyOpenPredictionModal(row, onBack) { if(!row)return; $('sectionRiskModalTitle').textContent='Prediction details'; $('sectionRiskModalBody').innerHTML=(onBack?'<button type="button" class="prediction-back-button" id="predictionBackButton" aria-label="Back to students in this section">← Back to section students</button>':'')+'<div class="prediction-detail-head"><span class="prediction-level '+(row.Prediction_Level==='High Failure Risk'?'high':row.Prediction_Level==='Moderate Failure Risk'?'moderate':'low')+'">'+escapeHTML(row.Prediction_Level)+'</span><strong>'+Number(row.Prediction_Score).toFixed(1)+'% risk score</strong></div><div class="section-risk-detail-grid"><span>Student ID<strong>'+escapeHTML(row.Student_ID)+'</strong></span><span>Subject<strong>'+escapeHTML(row.Subject_Name)+'</strong></span><span>Section<strong>'+escapeHTML(row.Section)+'</strong></span><span>Academic period<strong>'+escapeHTML(row.Academic_Year)+' · '+escapeHTML(row.Semester)+'</strong></span><span>Attendance<strong>'+Number(row.Attendance_Pct).toFixed(1)+'%</strong></span><span>Quiz average<strong>'+Number(row.Quiz_Average).toFixed(1)+'%</strong></span><span>Midterm score<strong>'+Number(row.Midterm_Score).toFixed(1)+'%</strong></span><span>Model risk score<strong>'+Number(row.Prediction_Score).toFixed(1)+'%</strong></span></div><div class="prediction-intervention"><h3>Recommended academic intervention</h3><p>'+escapeHTML(predictionIntervention(row))+'</p></div><p class="prediction-detail-note">This model estimates which students may be at risk of failing based on historical academic patterns. Use this result to prioritize faculty attention and early support.</p>'; if(onBack)$('predictionBackButton').addEventListener('click',onBack); $('sectionRiskModal').hidden=false; $('sectionRiskOverlay').hidden=false; document.body.classList.add('drawer-open'); (onBack?$('predictionBackButton'):$('sectionRiskModalClose')).focus(); }
function sectionPredictionInterpretation(section) {
  const high=section.predictionCounts.high,moderate=section.predictionCounts.moderate;
  if(high) return high+' student'+(high===1?' is':'s are')+' flagged High Failure Risk. Review attendance, quiz, and midterm indicators and prioritize early support.';
  if(moderate) return moderate+' student'+(moderate===1?' is':'s are')+' flagged Moderate Failure Risk. Continue monitoring and consider targeted academic support.';
  return 'No High or Moderate Failure Risk predictions are present in this section. Continue regular monitoring.';
}
function renderSectionRisk() {
  const target=$('sectionRiskList'); if(!target)return;
  const groups=sectionRiskGroups(),highStudents=new Set(filteredRecords.filter(row=>row.Prediction_Level==='High Failure Risk').map(row=>row.Student_ID)).size;
  target.innerHTML='<div class="section-risk-card-intro"><div><strong>Academic Risk Overview</strong><span>'+highStudents+' student'+(highStudents===1?'':'s')+' flagged High Failure Risk in the current view</span></div><span class="section-risk-card-intro-note">Select a section to review predictions</span></div>'+ (groups.length?groups.map((group,index)=>'<article class="section-risk-subject-card"><div class="section-risk-subject-main"><div class="section-risk-subject-title"><div><h3>'+escapeHTML(group.subject)+'</h3><p>'+group.sectionCount+' assigned section'+(group.sectionCount===1?'':'s')+' · '+group.grades.length+' academic records</p></div><span class="risk-level '+group.risk.toLowerCase()+'">'+group.risk+' Recorded Grade Risk</span></div><div class="section-risk-prediction-line"><span class="section-risk-prediction-label">Model prediction summary</span><strong>'+group.predictions.length+' screened · '+group.predictionCounts.high+' high · '+group.predictionCounts.moderate+' moderate</strong></div><p class="section-risk-interpretation">'+escapeHTML(group.predictions.length?sectionPredictionInterpretation({predictionCounts:group.predictionCounts}):'No matched prediction records are available for this subject in the current filters.')+'</p><div class="section-risk-section-buttons">'+group.sections.map(section=>'<button type="button" class="section-risk-section-button" data-section-risk-subject="'+index+'" data-section-risk-section="'+encodeURIComponent(section.section)+'">'+escapeHTML(section.section)+'</button>').join('')+'</div></div></article>').join(''):'<div class="section-risk-empty">No prediction records match the current academic filters.</div>');
  target.querySelectorAll('.section-risk-subject-card').forEach(card=>{const seen=new Set();card.querySelectorAll('[data-section-risk-section]').forEach(button=>{if(seen.has(button.dataset.sectionRiskSection)){button.remove();return;}seen.add(button.dataset.sectionRiskSection);const group=groups[Number(button.dataset.sectionRiskSubject)],section=decodeURIComponent(button.dataset.sectionRiskSection);button.addEventListener('click',()=>openSectionRiskModal(group.subject,group.sections.filter(item=>item.section===section)));});});
}
function openSectionRiskModal(subject,sections) {
  const modal=$('sectionRiskModal'); $('sectionRiskModalTitle').textContent=subject+' — Section details';
  predictionBackState=null;
  const backButton=$('predictionBackButton'); if(backButton){backButton.hidden=true;backButton.onclick=null;}
  $('sectionRiskModalBody').innerHTML='<div class="section-risk-period-tabs" role="tablist" aria-label="Academic periods">'+sections.map((section,index)=>'<button type="button" class="section-risk-period-tab'+(index===0?' active':'')+'" data-section-risk-period="'+index+'" role="tab" aria-selected="'+(index===0?'true':'false')+'">'+escapeHTML(section.year)+' · '+escapeHTML(section.semester)+'</button>').join('')+'</div><div class="section-risk-modal-sections">'+sections.map((section,index)=>'<article class="section-risk-modal-section" data-section-risk-period-panel="'+index+'"'+(index===0?'':' hidden')+'><div class="section-risk-modal-section-label">SECTION: '+escapeHTML(section.section)+'</div><div class="section-risk-modal-summary"><span>Subject<strong>'+escapeHTML(section.subject)+'</strong></span><span>Academic records<strong>'+section.grades.length+'</strong></span><span>High-risk predictions<strong>'+section.predictionCounts.high+'</strong></span><span>Moderate-risk predictions<strong>'+section.predictionCounts.moderate+'</strong></span></div><h3>Prediction interpretation</h3><p>'+escapeHTML(sectionPredictionInterpretation(section))+'</p><h3>Students requiring review</h3><div class="section-risk-student-list">'+(section.predictions.length?section.predictions.sort((a,b)=>Number(b.Prediction_Score)-Number(a.Prediction_Score)).map(row=>'<button type="button" class="section-risk-student-row" data-prediction-record="'+escapeHTML(row.Record_ID)+'"><strong>'+escapeHTML(row.Student_ID)+'</strong><span>'+escapeHTML(row.Prediction_Level)+'</span><b>'+Number(row.Prediction_Score).toFixed(1)+'%</b></button>').join(''):'<p>No prediction records are available for this section.</p>')+'</div><p class="prediction-detail-note">Predictions are estimates based on historical sample records and should guide faculty review and early support.</p></article>').join('')+'</div>';
  $('sectionRiskModalBody').querySelectorAll('[data-section-risk-period]').forEach(tab=>tab.addEventListener('click',()=>{const selected=Number(tab.dataset.sectionRiskPeriod);$('sectionRiskModalBody').querySelectorAll('[data-section-risk-period]').forEach(item=>{const active=Number(item.dataset.sectionRiskPeriod)===selected;item.classList.toggle('active',active);item.setAttribute('aria-selected',active?'true':'false');});$('sectionRiskModalBody').querySelectorAll('[data-section-risk-period-panel]').forEach(panel=>{panel.hidden=Number(panel.dataset.sectionRiskPeriodPanel)!==selected;});}));
  $('sectionRiskModalBody').querySelectorAll('[data-prediction-record]').forEach(row=>row.addEventListener('click',()=>openPredictionModal(filteredRecords.find(item=>item.Record_ID===row.dataset.predictionRecord),{restore:()=>openSectionRiskModal(subject,sections),scrollY:window.scrollY})));
  modal.hidden=false; $('sectionRiskOverlay').hidden=false; document.body.classList.add('drawer-open'); $('sectionRiskModalClose').focus();
}
function setupSectionRisk() {
  const records=$('records'); if(!records||$('sectionRisk'))return;
  records.id='sectionRisk'; records.className='section-risk-section section-anchor'; records.innerHTML='<div class="section-kicker">SECTION MONITORING</div><div class="section-risk-heading"><div><h2>Section Academic Risk</h2><p>Review students identified as potentially at risk of failing within the current filters.</p></div><span class="section-risk-rule">Student Failure Risk Predictions</span></div><div id="sectionRiskList" class="section-risk-list"></div>';
  document.querySelectorAll('.dashboard-jump a[href="#records"]').forEach(link=>{link.href='#sectionRisk';link.textContent='Section Risk';});
  document.body.insertAdjacentHTML('beforeend','<div id="sectionRiskOverlay" class="kpi-drawer-overlay" hidden></div><aside id="sectionRiskModal" class="section-risk-modal" role="dialog" aria-modal="true" aria-labelledby="sectionRiskModalTitle" hidden><div class="section-risk-modal-head"><button id="predictionBackButton" class="prediction-back-header" type="button" aria-label="Back to At-Risk Students" hidden>← <span>Back to At-Risk Students</span></button><h2 id="sectionRiskModalTitle">Section details</h2><button id="sectionRiskModalClose" class="kpi-drawer-close" type="button" aria-label="Close section details">×</button></div><div id="sectionRiskModalBody" class="section-risk-modal-body"></div></aside>');
  $('sectionRiskModalClose').addEventListener('click',closeSectionRiskModal); $('sectionRiskOverlay').addEventListener('click',closeSectionRiskModal); document.addEventListener('keydown',event=>{if(event.key==='Escape')closeSectionRiskModal();});
}
function getTableRecords() {
  const query=$('searchStudent').value.trim().toLowerCase(),status=$('statusFilter').value;
  return filteredRecords.filter(row => (status==='all'||row.Grade_Status===status)&&[row.Student_ID,row.Subject_Name,row.Faculty_ID].some(value => value.toLowerCase().includes(query))).sort((a,b) => {
    if(['Final_Grade','Year_Level'].includes(sortKey)) return (Number(a[sortKey])-Number(b[sortKey]))*sortDirection;
    return a[sortKey].localeCompare(b[sortKey],undefined,{numeric:true})*sortDirection;
  });
}

function renderRecords() {
  const rows=getTableRecords(),pages=Math.max(1,Math.ceil(rows.length/pageSize));
  page=Math.max(1,Math.min(page,pages));const start=(page-1)*pageSize;
  $('studentTable').innerHTML=rows.slice(start,start+pageSize).map(row => `<tr><td>${escapeHTML(row.Student_ID)}</td><td>Year ${escapeHTML(row.Year_Level)}</td><td title="${escapeHTML(row.Subject_Name)}">${escapeHTML(row.Subject_Name)}</td><td class="grade-cell">${Number(row.Final_Grade).toFixed(2)}</td><td><span class="status-pill ${passed(row)?'':'failed'}">${escapeHTML(row.Grade_Status)}</span></td><td>${escapeHTML(row.Faculty_ID)}</td><td>${row.SETE_Submitted==='Yes'&&numeric(row.SETE_Average_Rating)?Number(row.SETE_Average_Rating).toFixed(2):'—'}</td></tr>`).join('')||'<tr><td colspan="7" class="empty-state">No records found. Try a different search or reset your filters.</td></tr>';
  $('recordBadge').textContent=rows.length;
  $('paginationInfo').textContent=rows.length?`Showing ${start+1}–${Math.min(start+pageSize,rows.length)} of ${rows.length} records`:'0 matching records';
  $('pageInfo').textContent=`Page ${page} of ${pages}`;
  $('previousPage').disabled=page===1;$('nextPage').disabled=page===pages;
  document.querySelectorAll('[data-sort]').forEach(button => button.parentElement.setAttribute('aria-sort',button.dataset.sort===sortKey?(sortDirection===1?'ascending':'descending'):'none'));
}

function renderInsight() {
  if(!$('insightTitle')) return;
  const grades=validGrades(filteredRecords),subjects=unique(filteredRecords,'Subject_Name'),students=unique(filteredRecords,'Student_ID');
  $('insightTitle').textContent=grades.length?`${grades.length} academic records in this view.`:'No academic records in this selection.';
  $('insightText').textContent=grades.length?`${students.length} students across ${subjects.length} subject${subjects.length===1?'':'s'}. Review the filtered academic records below.`:'Reset your filters to view the academic records.';
  if($('insightAction').firstChild) $('insightAction').firstChild.textContent='View records ';
  $('insightAction').dataset.status='all';
}

function changeView() {
  const target=document.getElementById(location.hash.slice(1));
  if(target) setTimeout(()=>target.scrollIntoView({behavior:'smooth',block:'start'}),0);
/*
  const titles={overview:['Overview','A clearer view of student success and teaching effectiveness.'],academics:['Academic performance','Explore student outcomes, subject performance, and grade distributions.'],teaching:['Teaching effectiveness','Listen to student feedback and understand the teaching experience.'],records:['Student records','Find the individual academic records behind every insight.']};
  const view=location.hash.slice(1)||'overview',selected=titles[view]?view:'overview';
  document.body.dataset.view=selected;
  document.querySelectorAll('[data-views]').forEach(node => node.hidden=!node.dataset.views.split(' ').includes(selected));
  document.querySelectorAll('[data-nav]').forEach(node => {node.classList.toggle('active',node.dataset.nav===selected);if(node.dataset.nav===selected) node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');});
  $('pageTitle').innerHTML=`${titles[selected][0]}<span class="brand-dot">.</span>`;
  $('pageSubtitle').textContent=titles[selected][1];$('breadcrumbCurrent').textContent=titles[selected][0];
  document.title=`${titles[selected][0]} · ACADlytics`;
  $('sidebar').classList.remove('open');$('menuButton').setAttribute('aria-expanded','false');
*/
}

function viewStatus(status) {
  $('statusFilter').value=status;page=1;
  hideTooltip();renderRecords();
  const target=$('records')||$('sectionRisk');
  if(target){location.hash=target.id;target.scrollIntoView({behavior:'smooth',block:'start'});}
}
function hideTooltip() {
  const tooltip=$('chartTooltip');if(tooltip)tooltip.hidden=true;
  document.querySelectorAll('[aria-describedby="chartTooltip"]').forEach(node=>node.removeAttribute('aria-describedby'));
}
function exportReport() {
  const rows=filteredRecords.length?filteredRecords:allRecords;
  if(!rows.length) return;
  const headers=['Student_ID','Year_Level','Academic_Year','Semester','Subject_Name','Final_Grade','Grade_Status','Faculty_ID','SETE_Eligible','SETE_Submitted','SETE_Average_Rating'];
  const csv=[headers,...rows.map(row=>headers.map(header=>{const value=String(row[header]??'');return /[",\n]/.test(value)?`"${value.replace(/"/g,'""')}"`:value;}))].map(row=>row.join(',')).join('\r\n');
  const link=document.createElement('a'); link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); link.download=`acadlytics-report-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
}
function positionTooltip(x,y) {
  const tooltip=$('chartTooltip'),rect=tooltip.getBoundingClientRect();
  tooltip.style.left=`${Math.max(10,Math.min(x+14,innerWidth-rect.width-12))}px`;
  tooltip.style.top=`${Math.max(10,y+rect.height+24>innerHeight?y-rect.height-12:y+16)}px`;
}
function showTooltip(target,event) {
  const tooltip=$('chartTooltip');hideTooltip();tooltip.textContent=target.dataset.tooltip;tooltip.hidden=false;
  target.setAttribute('aria-describedby','chartTooltip');
  const rect=target.getBoundingClientRect();positionTooltip(event.clientX??rect.left+rect.width/2,event.clientY??rect.bottom);
}
if(isDashboard) {
  setupDashboardUI();
  setupProfileMenu();
  setupSectionRisk();
  document.querySelectorAll('.dashboard-jump a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
    const target=document.getElementById(link.getAttribute('href').slice(1));
    if(!target)return;
    event.preventDefault();
    history.pushState(null,'',link.getAttribute('href'));
    target.scrollIntoView({behavior:'smooth',block:'start'});
  }));
  document.querySelectorAll('.jump-card').forEach(card=>{const go=()=>openKPIDrawer(card);card.addEventListener('click',go);card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();go();}});});
  filters.forEach(id=>$(id).addEventListener('change',()=>{message('');updateDashboard();}));
  $('yearChartMetric')?.addEventListener('change',renderYearChart);
  $('resetFilters').addEventListener('click',()=>{filters.forEach(id=>$(id).value='all');selectedDimension=null;message('');updateDashboard();});
  $('riskLevelFilter').addEventListener('change',()=>{riskExpanded=false;renderRisk();});
  $('showMoreRisk').addEventListener('click',()=>{riskExpanded=!riskExpanded;renderRisk();});
  $('exportReport').addEventListener('click',exportReport);
  $('notificationButton').addEventListener('click',event=>{event.stopPropagation();const panel=$('notificationPanel'),open=panel.hidden;panel.hidden=!open;$('notificationButton').setAttribute('aria-expanded',String(open));});
  $('closeNotifications').addEventListener('click',()=>{$('notificationPanel').hidden=true;$('notificationButton').setAttribute('aria-expanded','false');});
  $('notificationPanel').addEventListener('click',event=>event.stopPropagation());
  document.addEventListener('click',()=>{if(!$('notificationPanel').hidden){$('notificationPanel').hidden=true;$('notificationButton').setAttribute('aria-expanded','false');}});
  $('notificationList').addEventListener('click',event=>{const item=event.target.closest('[data-notification-target]');if(!item)return;const target=document.getElementById(item.dataset.notificationTarget);$('notificationPanel').hidden=true;$('notificationButton').setAttribute('aria-expanded','false');if(target){location.hash=target.id;target.scrollIntoView({behavior:'auto',block:'start'});}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape') hideTooltip();});
  document.addEventListener('click',event=>{
    const column=event.target.closest('[data-year]'),subject=event.target.closest('[data-subject]'),status=event.target.closest('[data-status]'),dimension=event.target.closest('[data-dimension]');
    if(column){$('yearFilter').value=$('yearFilter').value===column.dataset.year?'all':column.dataset.year;updateDashboard();}
    if(subject){$('subjectFilter').value=$('subjectFilter').value===subject.dataset.subject?'all':subject.dataset.subject;updateDashboard();}
    if(status)viewStatus(status.dataset.status);
    if(dimension){selectedDimension=selectedDimension===dimension.dataset.dimension?null:dimension.dataset.dimension;hideTooltip();renderTeaching();}
  });
  document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-year]')){event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
  document.addEventListener('pointerover',event=>{const target=event.target.closest('[data-tooltip]');if(target&&!target.contains(event.relatedTarget))showTooltip(target,event);});
  document.addEventListener('pointermove',event=>{if(!$('chartTooltip').hidden)positionTooltip(event.clientX,event.clientY);});
  document.addEventListener('pointerout',event=>{const target=event.target.closest('[data-tooltip]');if(target&&!target.contains(event.relatedTarget))hideTooltip();});
  document.addEventListener('focusin',event=>{const target=event.target.closest('[data-tooltip]');if(target)showTooltip(target,event);});
  document.addEventListener('focusout',hideTooltip);
  window.addEventListener('scroll',hideTooltip,true);
}
loadDataset();

// Final local prediction view: screenshot-inspired subject cards plus the
// compact interactive student screening table required by the dashboard.
function renderSectionRisk() {
  const target = $('sectionRiskList');
  if (!target) return;
  const groups = sectionRiskGroups();
  const baseRows = predictionRows();
  const highStudents = new Set(baseRows.filter(row => row.Prediction_Level === 'High Failure Risk').map(row => row.Student_ID)).size;
  const counts = {
    High: baseRows.filter(row => row.Prediction_Level === 'High Failure Risk').length,
    Moderate: baseRows.filter(row => row.Prediction_Level === 'Moderate Failure Risk').length,
    Low: baseRows.filter(row => row.Prediction_Level === 'Low Failure Risk').length,
  };
  const rows = baseRows
    .filter(row => predictionRiskFilter === 'all' || row.Prediction_Level === predictionRiskFilter + ' Failure Risk')
    .filter(row => !predictionSearch || String(row.Student_ID).toLowerCase().includes(predictionSearch));
  const pages = Math.max(1, Math.ceil(rows.length / predictionPageSize));
  predictionPage = Math.min(predictionPage, pages);
  const start = (predictionPage - 1) * predictionPageSize;
  const visible = rows.slice(start, start + predictionPageSize);
  const chip = (key, label) => '<button type="button" class="prediction-filter-chip ' + (predictionRiskFilter === key ? 'active ' : '') + 'risk-' + key.toLowerCase() + '" data-prediction-filter="' + key + '"><span>' + label + '</span><strong>' + counts[key] + '</strong></button>';
  const alert = highStudents
    ? '<div class="academic-risk-alert"><span class="prediction-alert-icon" aria-hidden="true">!</span><div><strong>Academic Risk Alert</strong><p>' + highStudents + ' student' + (highStudents === 1 ? ' is' : 's are') + ' currently flagged as High Failure Risk. Review these records and consider early academic support.</p></div><button type="button" class="prediction-alert-action" id="viewHighRisk">View High-Risk Students</button></div>'
    : '<div class="academic-risk-alert neutral"><span class="prediction-alert-icon" aria-hidden="true">i</span><div><strong>No high-risk students in this view</strong><p>Continue monitoring the current filtered records and provide support where needed.</p></div></div>';
  const cards = groups.length ? groups.map((group, index) => {
    const sections = [...new Set(group.sections.map(section => section.section))];
    return '<article class="section-risk-subject-card"><div class="section-risk-subject-main"><div class="section-risk-subject-title"><div><h3>' + escapeHTML(group.subject) + '</h3><p>' + group.sectionCount + ' assigned section' + (group.sectionCount === 1 ? '' : 's') + ' · ' + group.grades.length + ' academic records</p></div><span class="risk-level ' + group.risk.toLowerCase() + '">' + group.risk + ' Recorded Grade Risk</span></div><div class="section-risk-prediction-line"><span class="section-risk-prediction-label">Model prediction summary</span><strong>' + group.predictions.length + ' screened · ' + group.predictionCounts.high + ' high · ' + group.predictionCounts.moderate + ' moderate</strong></div><p class="section-risk-interpretation">' + escapeHTML(group.predictions.length ? sectionPredictionInterpretation({ predictionCounts: group.predictionCounts }) : 'No matched prediction records are available for this subject in the current filters.') + '</p><div class="section-risk-section-buttons">' + sections.map(section => '<button type="button" class="section-risk-section-button" data-section-risk-subject="' + index + '" data-section-risk-section="' + encodeURIComponent(section) + '">' + escapeHTML(section) + '</button>').join('') + '</div></div></article>';
  }).join('') : '<div class="section-risk-empty">No section academic data matches the current academic filters.</div>';
  const tableRows = visible.length ? visible.map(row => '<tr tabindex="0" role="button" data-prediction-record="' + escapeHTML(row.Record_ID) + '"><td><strong>' + escapeHTML(row.Student_ID) + '</strong></td><td>' + escapeHTML(row.Subject_Name) + '</td><td>' + escapeHTML(row.Section) + '</td><td>' + escapeHTML(row.Academic_Year) + ' · ' + escapeHTML(row.Semester) + '</td><td><span class="prediction-level ' + (row.Prediction_Level === 'High Failure Risk' ? 'high' : row.Prediction_Level === 'Moderate Failure Risk' ? 'moderate' : 'low') + '">' + escapeHTML(row.Prediction_Level) + '</span></td><td><strong>' + Number(row.Prediction_Score).toFixed(1) + '%</strong></td></tr>').join('') : '<tr><td colspan="6" class="empty-state">No prediction records match the current filters.</td></tr>';
  target.innerHTML = '<div class="section-risk-card-intro"><div><strong>Academic Risk Overview</strong><span>' + highStudents + ' student' + (highStudents === 1 ? '' : 's') + ' flagged High Failure Risk in the current view</span></div><span class="section-risk-card-intro-note">Select a section to review predictions</span></div>' + cards + '<div class="section-risk-prediction-panel"><h3>Student Failure Risk Predictions</h3>' + alert + '<div class="prediction-toolbar"><label class="prediction-search"><span data-icon="search"></span><input id="predictionStudentSearch" type="search" placeholder="Search Student ID" aria-label="Search predicted student ID" value="' + escapeHTML(predictionSearch) + '"></label><div class="prediction-filter-chips" aria-label="Filter predictions by risk level">' + chip('High', 'High') + chip('Moderate', 'Moderate') + chip('Low', 'Low') + '</div><button type="button" class="prediction-sort-button" id="predictionSortButton">Score ' + (predictionSortDirection === -1 ? '↓' : '↑') + '</button><button type="button" class="prediction-reset-button" id="predictionResetButton">Reset</button></div><div class="prediction-table-wrap"><table class="prediction-table"><thead><tr><th>Student ID</th><th>Subject</th><th>Section</th><th>Academic period</th><th>Risk level</th><th><button type="button" id="predictionSortHeader">Risk score ↕</button></th></tr></thead><tbody>' + tableRows + '</tbody></table></div><div class="prediction-table-footer"><span>Showing ' + (rows.length ? start + 1 : 0) + '–' + Math.min(start + predictionPageSize, rows.length) + ' of ' + rows.length + ' predicted students</span><div><button type="button" class="pagination-button" id="predictionPrevious" aria-label="Previous prediction page"' + (predictionPage === 1 ? ' disabled' : '') + '>‹</button><span>Page ' + predictionPage + ' of ' + pages + '</span><button type="button" class="pagination-button" id="predictionNext" aria-label="Next prediction page"' + (predictionPage === pages ? ' disabled' : '') + '>›</button></div></div></div>';
  document.querySelectorAll('#sectionRisk [data-icon]').forEach(node => { node.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + (iconPaths[node.dataset.icon] || '') + '</svg>'; });
  target.querySelectorAll('[data-section-risk-section]').forEach(button => button.addEventListener('click', () => { const group = groups[Number(button.dataset.sectionRiskSubject)]; const section = decodeURIComponent(button.dataset.sectionRiskSection); openSectionRiskModal(group.subject, group.sections.filter(item => item.section === section)); }));
  target.querySelectorAll('[data-prediction-filter]').forEach(button => button.addEventListener('click', () => { predictionRiskFilter = button.dataset.predictionFilter; predictionPage = 1; renderSectionRisk(); }));
  $('viewHighRisk')?.addEventListener('click', () => { predictionRiskFilter = 'High'; predictionSearch = ''; predictionPage = 1; renderSectionRisk(); });
  $('predictionStudentSearch').addEventListener('input', event => { predictionSearch = event.target.value.trim().toLowerCase(); predictionPage = 1; renderSectionRisk(); });
  const sort = () => { predictionSortDirection *= -1; predictionPage = 1; renderSectionRisk(); };
  $('predictionSortButton').addEventListener('click', sort); $('predictionSortHeader').addEventListener('click', sort);
  $('predictionResetButton').addEventListener('click', () => { predictionRiskFilter = 'all'; predictionSearch = ''; predictionSortDirection = -1; predictionPage = 1; renderSectionRisk(); });
  $('predictionPrevious').addEventListener('click', () => { predictionPage--; renderSectionRisk(); }); $('predictionNext').addEventListener('click', () => { predictionPage++; renderSectionRisk(); });
  target.querySelectorAll('[data-prediction-record]').forEach(row => { const open = () => openPredictionModal(filteredRecords.find(item => item.Record_ID === row.dataset.predictionRecord), { restore: () => renderSectionRisk(), scrollY: window.scrollY }); row.addEventListener('click', open); row.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }); });
}
