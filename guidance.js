(function(root,factory){
  const value=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=value;
  root.MopnoteGuidance=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const documents=Object.freeze([
    {
      id:'scope',question:'How should I estimate only selected rooms rather than a whole house?',
      answer:'Start from the requested rooms and add time or rates per kitchen, bathroom, bedroom and special task. Do not rely only on total square footage when parts of a property are excluded.',
      url:'https://www.reddit.com/r/cleaningbusiness/comments/1sy2tna/i_need_help_with_quote_calculator/',
      source:'Cleaning owners discussing selected-room quotes'
    },
    {
      id:'cost',question:'What hidden costs should I include in cleaning pricing?',
      answer:'Count labor hours, loaded wages, supplies, travel, overhead and payment fees. A revenue amount left after wages alone is not net profit. Use actual local costs rather than default sample prices.',
      url:'https://www.reddit.com/r/cleaningbusiness/comments/1wkw5j2/how_are_you_actually_pricing_your_cleaning_jobs/',
      source:'Owners comparing flat, hourly and area-based pricing'
    },
    {
      id:'labor',question:'Why does a quote end up underpriced when bathrooms or first-time cleaning are involved?',
      answer:'Scope, buildup, bathrooms, setup, access and first-time visits can stretch working time. Check estimated crew-hours and agree scope changes before changing the final price.',
      url:'https://www.reddit.com/r/cleaningbusiness/comments/1twhev6/where_do_cleaning_quotes_usually_go_wrong/',
      source:'Discussion of labor-time and scope surprises'
    },
    {
      id:'commercial',question:'How do I sanity-check a commercial cleaning quote?',
      answer:'Separate labor-hours from elapsed crew time: two cleaners working four hours represent eight paid hours. Deduct true loaded labor cost and nonlabor expenses before calling anything profit.',
      url:'https://www.reddit.com/r/cleaningbusiness/comments/1w0b0un/need_help_quoting_first_commercial_cleaning_job/',
      source:'Office cleaning quote with crew cost breakdown'
    },
    {
      id:'walkthrough',question:'How do I make walkthroughs and follow-ups more reliable?',
      answer:'Record the same fields for scope, fixtures, frequency and access on every job, then record a follow-up date. A calculator alone will not replace clarification and a human confirmation.',
      url:'https://www.reddit.com/r/cleaningbusiness/comments/1x8ngm9/commercial_cleaning_owners_how_do_you_actually/',
      source:'Cleaning operators discussing walkthrough records'
    },
    {
      id:'conversion',question:'Should I offer instant prices or ask customers to contact me?',
      answer:'There are mixed opinions: instant estimates can reduce effort, but some cleaners prefer talking before committing to a price. Treat the online figure as an estimate and keep a direct contact step.',
      url:'https://www.reddit.com/r/cleaningbusiness/comments/1wrm9u4/dynamic_pricing/',
      source:'Mixed community reactions to website-based instant pricing'
    },
    {
      id:'pricing',question:'Do recurring discounts reduce my target margin?',
      answer:'Compare the discounted quote against all labor and nonlabor costs. Underpricing becomes obvious when expenses are broken down. Model the discount and costs together before offering it.',
      url:'https://www.reddit.com/r/cleaningbusiness/comments/1svr0y4/i_just_realized_ive_been_undercharging_every/',
      source:'Owners discussing the consequences of underquoting'
    }
  ]);
  function tokenize(text){
    return String(text||'').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
  }
  const vectors=documents.map(doc=>{
    const terms=tokenize(doc.question+' '+doc.question+' '+doc.answer);
    const counts=new Map();
    for(const word of terms)counts.set(word,(counts.get(word)||0)+1);
    return {doc,counts,length:terms.length};
  });
  const avgLength=vectors.reduce((sum,v)=>sum+v.length,0)/vectors.length;
  const docFreq=new Map();
  for(const v of vectors)for(const word of v.counts.keys())docFreq.set(word,(docFreq.get(word)||0)+1);
  function retrieve(question,limit=3){
    const words=[...new Set(tokenize(question))];
    if(!words.length)return [];
    const scored=vectors.map(v=>{
      let score=0;
      for(const word of words){
        const freq=v.counts.get(word)||0;
        if(!freq)continue;
        const idf=Math.log(1+(vectors.length-(docFreq.get(word)||0)+.5)/((docFreq.get(word)||0)+.5));
        score+=idf*freq*2.2/(freq+1.2*(.25+.75*v.length/avgLength));
      }
      return { ...v.doc,score };
    });
    return scored.filter(v=>v.score>.01).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(5,limit)));
  }
  return Object.freeze({documents,tokenize,retrieve});
});
