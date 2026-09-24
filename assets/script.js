let recorder=null, chunks=[], stream=null, startedAt=0, timerId=null, audioBlob=null;

const startBtn=document.getElementById("start");
const stopBtn=document.getElementById("stop");
const analyzeBtn=document.getElementById("analyze");
const statusEl=document.getElementById("status");
const timerEl=document.getElementById("timer");
const player=document.getElementById("player");
const resultCard=document.getElementById("resultCard");

function setTimer(){
  const s=Math.floor((Date.now()-startedAt)/1000);
  const m=String(Math.floor(s/60)).padStart(2,"0");
  const sec=String(s%60).padStart(2,"0");
  timerEl.textContent=`${m}:${sec}`;
}

startBtn.onclick=async()=>{
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true});
    chunks=[];
    recorder=new MediaRecorder(stream);
    recorder.ondataavailable=e=>{if(e.data.size) chunks.push(e.data)};
    recorder.onstop=()=>{
      audioBlob=new Blob(chunks,{type:recorder.mimeType||"audio/webm"});
      player.src=URL.createObjectURL(audioBlob);
      player.hidden=false;
      analyzeBtn.disabled=false;
      statusEl.textContent="ضبط تمام شد. حالا «تحلیل صدا» را بزن.";
      stream.getTracks().forEach(t=>t.stop());
    };
    recorder.start();
    startedAt=Date.now();
    timerId=setInterval(setTimer,200);
    startBtn.disabled=true; stopBtn.disabled=false; analyzeBtn.disabled=true;
    statusEl.textContent="در حال ضبط... چند بار طبیعی سرفه کن.";
  }catch(e){
    statusEl.textContent="دسترسی به میکروفون داده نشد. در تنظیمات مرورگر اجازه Microphone را فعال کن.";
  }
};

stopBtn.onclick=()=>{
  if(recorder && recorder.state!=="inactive") recorder.stop();
  clearInterval(timerId);
  startBtn.disabled=false; stopBtn.disabled=true;
};

analyzeBtn.onclick=async()=>{
  if(!audioBlob) return;
  analyzeBtn.disabled=true;
  statusEl.textContent="در حال تحلیل صدا...";
  try{
    const arrayBuffer=await audioBlob.arrayBuffer();
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const audio=await ctx.decodeAudioData(arrayBuffer);
    const data=audio.getChannelData(0);
    const duration=audio.duration;
    let sum=0, peak=0;
    for(let i=0;i<data.length;i++){
      const a=Math.abs(data[i]);
      sum+=a*a;
      if(a>peak) peak=a;
    }
    const rms=Math.sqrt(sum/data.length);
    const threshold=Math.max(0.08, rms*2.3);
    let active=0, events=0, inEvent=false, gap=0;
    const step=Math.max(1,Math.floor(audio.sampleRate/100));
    for(let i=0;i<data.length;i+=step){
      const a=Math.abs(data[i]);
      if(a>threshold){
        active++;
        gap=0;
        if(!inEvent){events++;inEvent=true}
      }else if(inEvent){
        gap++;
        if(gap>18) inEvent=false;
      }
    }
    const loud=Math.min(100,Math.round(rms*260));
    let pattern,desc,care;
    if(events===0 || duration<0.5){
      pattern="صدای کافی برای تحلیل پیدا نشد";
      desc="صدای ضبط‌شده برای یک تحلیل آموزشی کافی نیست. دوباره در محیط ساکت‌تر ضبط کن.";
      care="این نتیجه به معنی سالم یا بیمار بودن نیست.";
    }else if(events>=7 && duration<=20){
      pattern="الگوی سرفه‌های متعدد";
      desc="در این ضبط چند بخش صوتی جداگانه شناسایی شد. این الگو به‌تنهایی علت سرفه را مشخص نمی‌کند.";
      care="استراحت، نوشیدن مایعات و توجه به روند علائم می‌تواند مفید باشد. اگر سرفه ادامه‌دار یا شدید است، با پزشک مشورت شود.";
    }else if(loud>=55){
      pattern="الگوی سرفه نسبتاً پرقدرت";
      desc="شدت صوتی ضبط‌شده نسبتاً زیاد بوده است. شدت صدا به فاصله از میکروفون و محیط هم وابسته است و بیماری را تشخیص نمی‌دهد.";
      care="از دود و محرک‌های تنفسی دور بمان و مایعات کافی مصرف کن. برای علائم شدید یا ماندگار، ارزیابی پزشکی لازم است.";
    }else{
      pattern="الگوی سرفه خفیف تا متوسط";
      desc="در این ضبط شدت صوتی بالا نیست. از روی این ویژگی نمی‌توان علت یا بیماری را تعیین کرد.";
      care="استراحت و مایعات کافی می‌تواند به مراقبت عمومی کمک کند. اگر علائم بدتر شد یا طولانی شد، از پزشک کمک بگیر.";
    }
    document.getElementById("score").textContent=`${Math.round(Math.min(99,50+loud/2))}%`;
    document.getElementById("pattern").textContent=pattern;
    document.getElementById("description").textContent=desc;
    document.getElementById("careText").textContent=care;
    document.getElementById("loudness").textContent=`${loud}/100`;
    document.getElementById("events").textContent=events;
    document.getElementById("duration").textContent=`${duration.toFixed(1)} ثانیه`;
    resultCard.hidden=false;
    statusEl.textContent="تحلیل انجام شد.";
    await ctx.close();
  }catch(e){
    statusEl.textContent="فرمت صدای ضبط‌شده قابل تحلیل نبود. دوباره ضبط کن.";
  }finally{analyzeBtn.disabled=false;}
};
