/*
软件名称:云扫码 微信扫描二维码打开
更新时间：2021-02-28 @肥皂
脚本说明：云扫码自动阅读
脚本为自动完成云扫码的阅读任务
每日收益1元左右，可多号撸。提现秒到
类似番茄看看，番茄看看黑了就跑云扫码，云扫码黑了就跑番茄看看
哈哈哈啊哈哈哈哈

任务打开二维码地址 https://raw.githubusercontent.com/age174/-/main/3B7C4F94-B961-4690-8DF7-B27998789124.png
微信扫描打开，保存临时码，再去扫码获取数据



本脚本以学习为主！
首次运行脚本，会提示获取数据
去云扫码，点击开始阅读，阅读几秒返回结算成功获取数据

TG电报群: https://t.me/hahaha802


boxjs地址 :  

https://raw.githubusercontent.com/age174/-/main/feizao.box.json


云扫码
圈X配置如下，其他软件自行测试，定时可以多设置几次，没任务会停止运行的
[task_local]
#云扫码
15 12,14,16,20,22 * * * https://raw.githubusercontent.com/age174/-/main/ysm.js, tag=云扫码, img-url=https://s3.ax1x.com/2021/02/28/6CRWb8.jpg, enabled=true


[rewrite_local]
#云扫码
^http://.*./yunonline/v1/ url script-request-body https://raw.githubusercontent.com/age174/-/main/ysm.js



#loon
^http://.*./yunonline/v1/ script-path=https://raw.githubusercontent.com/age174/-/main/ysm.js, requires-body=true, timeout=10, tag=云扫码



#surge

云扫码 = type=http-request,pattern=^http://.*./yunonline/v1/,requires-body=1,max-size=0,script-path=https://raw.githubusercontent.com/age174/-/main/ysm.js,script-update-interval=0




[MITM]
hostname = .*.top


*/

const $ = new Env('云扫码');
let ysm = $.getjson('ysm', []);
let ysmCkMoveFlag = $.getval('ysmCkMove') || '';
let concurrency = ($.getval('ysmConcurrency') || '1') - 0; // 并发执行任务的账号数，默单账号循环执行
concurrency = concurrency < 1 ? 1 : concurrency;

!(async () => {
  if (typeof $request !== "undefined") {
    await ysmck()
  } else if (ysmCkMoveFlag == 'true') {
    await ysmCkMove();
  } else {
    let acList = ysm.filter(o => o.openid).map((o, i) => ({no: i+1, last_gold: 0, day_gold: 0, remain_read: 0, day_read: 0, openid: o.openid, origin: o.origin, headers: JSON.parse(o.headers), body: JSON.parse(o.body)}));
    let execAcList = [];
    let slot = acList.length % concurrency == 0 ? acList.length / concurrency : parseInt(acList.length / concurrency) + 1;
    acList.forEach((o, i) => {
      let idx = i % slot;
      if (execAcList[idx]) {
        execAcList[idx].push(o);
      } else {
        execAcList[idx] = [o];
      }
    });
    $.log(`----------- 共${acList.length}个账号分${execAcList.length}组去执行 -----------`);
    for (let arr of execAcList) {
      let allAc = arr.map(ac => ac.no).join(', ');
      $.log(`\n=======================================\n开始【${$.name}账号：${allAc}】`);
      let rtList = await Promise.all(arr.map((ac, i) => execTask(ac, i)));
      let msg = rtList.map(ac => `【账号${ac.no}】余额：${ac.last_gold}币 阅读数：${ac.day_read} 待读数：${ac.remain_read}`).join('\n');
      $.msg(`${$.name} ${allAc}`, '', msg);
    }
  }
})()
.catch((e) => $.logErr(e))
  .finally(() => $.done());

function execTask(ac, i) {
  return new Promise(resolve => {
    setTimeout(async () => {
      try {
        await ysm4(ac);
        if (ac.remain_read && ac.day_read) {
          let flag = 0;
          let count = 1;
          let allowErrorCount = 3;
          do {
            flag = await ysm1(ac, count++);
            if (flag < 0) {
              allowErrorCount--;
            }
          } while (flag && allowErrorCount);
        } else {
          $.log(`账号${ac.no}今日已阅读${ac.day_read}次，今日待阅读${ac.remain_read}次，跳过阅读`);
        }
      } catch (e) {
        $.logErr(e, `账号${ac.no} 循环执行任务出现异常`);
      } finally{
        resolve(ac);
      }
    }, i * 500);
  })
}

//云扫码数据获取
async function ysmck() {
  if ($request.url.indexOf("v1/task") > -1) {
    const url = $request.url;
    const hd = $request.headers;
    const bd = JSON.stringify($request.body);
    let data = (hd['Referer'] || hd['referer'] || '').match(/^(https?:\/\/.+?)\/.+?\?openid=(.+)/);
    let openid = data && data[2];
    if (openid) {
      let status = 1;
      let no = ysm.length;
      for (let i = 0, len = no; i < len; i++) {
        let ac = ysm[i] || {};
        if (ac.openid) {
          if (ac.openid == openid) {
            no = i;
            status = 0;
            break;
          }
        } else if (no == len) {
          no = i;
        }
      }
      ysm[no] = {
        openid: openid,
        origin: data[1],
        headers: JSON.stringify(hd),
        body: bd
      };
      $.setdata(JSON.stringify(ysm, null, 2), 'ysm');
      $.msg($.name, "", `云扫码[账号${no+1}] ${status?'新增':'更新'}数据成功！`);
    } else {
      $.log('数据解析失败，请检查重写配置或解析规则已失效', `url: ${url}`, `headers: ${JSON.stringify(hd, null, 2)}`, `body: ${bd}`);
      $.msg($.name, '', '数据解析失败，请检查重写配置或解析规则已失效');
    }
  }
}

async function ysmCkMove() {
  let ysmArr = [];
  let ysmcount = ($.getval('ysmcount') || '0') - 0;
  for (let i = 1; i <= ysmcount; i++) {
    let hd = $.getjson(`ysmhd${i>1?i:''}`);
    let bd = $.getdata(`ysmbody${i>1?i:''}`);
    if(hd){
      let data = (hd['Referer'] || hd['referer'] || '').match(/^(https?:\/\/.+?)\/.+?\?openid=(.+)/);
      let openid = data && data[2];
      if (openid) {
        ysmArr.push({
          openid: openid,
          origin: data[1],
          headers: JSON.stringify(hd),
          body: bd
        });
      }
    }
  }
  if (ysmArr.length > 0) {
    let existsId = ysm.map(o => o.openid);
    for(let ac of ysmArr){
      if (!existsId.includes(ac.openid)) {
        ysm.push(ac);
        existsId.push(ac.openid);
      }
    }
    $.setdata(JSON.stringify(ysm, null, 2), 'ysm');
    $.msg($.name, "", `云扫码数据迁移后共${ysm.length}个账号！`);
  } else {
    $.log('无待迁移的旧数据');
  }
  $.setval('', 'ysmCkMove');
}

// 金币信息查询
function ysm4(ac) {
  return new Promise((resolve) => {
    let opts = {
      url: `${ac.origin}/yunonline/v1/gold?openid=${ac.openid}&time=${Date.parse(new Date())}`,
      headers: ac.headers
    }
    $.get(opts, (err, resp, data) => {
      try {
        if (err) {
          $.log(`${$.name} 请求失败，请检查网路重试\n url: ${opts.url} \n data: ${JSON.stringify(err, null, 2)}`);
        } else {
          const result = JSON.parse(data)
          if (result.errcode == 0 && result.data) {
            ac.last_gold = (result.data.last_gold || 0) - 0;
            ac.day_read = (result.data.day_read || 0) - 0;
            ac.day_gold = (result.data.day_gold || 0) - 0;
            ac.remain_read = (result.data.remain_read || 0) - 0;
          }
        }
      } catch (e) {
        $.log(`=================账号 ${ac.no}：\nurl: ${opts.url}\ndata: ${resp && resp.body}`);
        $.logErr(e, resp);
      } finally {
        resolve();
      }
    })
  })
}

//云扫码领取
function ysm3(ac, time) {
  return new Promise((resolve) => {
    let opts = {
      url: `${ac.origin}/yunonline/v1/add_gold`,
      headers: ac.headers,
      body: `openid=${ac.openid||''}&time=${time}`
    }
    $.post(opts, (err, resp, data) => {
      try {
        if (err) {
          $.log(`${$.name} 请求失败，请检查网路重试\n url: ${opts.url} \n data: ${JSON.stringify(err, null, 2)}`);
        } else {
          const result = JSON.parse(data)
          if (result.errcode == 0 && result.data) {
            ac.last_gold = (result.data.last_gold || 0) - 0;
            ac.day_read = (result.data.day_read || 0) - 0;
            ac.day_gold = (result.data.day_gold || 0) - 0;
            ac.remain_read = (result.data.remain_read || 0) - 0;
            if (ac.remain_read <= 0) {
              $.msg(`${$.name}: 账号${ac.no}`, '', `今日阅读已达上限，请明日继续`);
            }
            $.log(`🌝账号${ac.no}：本次奖励：${result.data.gold}, 当前余额: ${ac.last_gold}`, `今日阅读次数: ${ac.day_read}, 今日阅读奖励: ${ac.day_gold}`, `今日剩余阅读次数：${ac.remain_read}`);
          } else {
            $.log(`🚫账号${ac.no}：${result.msg}，跳过本次循环`, data);
          }
        }
      } catch (e) {
        $.log(`=================账号 ${ac.no}：\nurl: ${opts.url}\ndata: ${resp && resp.body}`);
        $.logErr(e, resp);
      } finally {
        resolve();
      }
    })
  })
}

//云扫码提交     
function ysm2(ac, jumpLink) {
  return new Promise((resolve) => {
    let opts = {
      url: jumpLink,
      headers: ac.headers
    };
    $.get(opts, (err, resp, data) => {
      let rtObj = {};
      try {
        if (err) {
          $.log(`${$.name} 请求失败，请检查网路重试\n url: ${opts.url} \n data: ${JSON.stringify(err, null, 2)}`);
        } else {
          rtObj = $.toObj(data, rtObj);
        }
      } catch (e) {
        $.log(`=================账号 ${ac.no}：\nurl: ${opts.url}\ndata: ${resp && resp.body}`);
        $.logErr(e, resp);
      } finally {
        resolve(rtObj)
      }
    })
  })
}

//云扫码key
function ysm1(ac, count) {
  return new Promise((resolve) => {
    let opts = {
      url: `${ac.origin}/yunonline/v1/task`,
      headers: ac.headers,
      body: ac.body
    }
    $.post(opts, async (err, resp, data) => {
      let f = -1;
      try {
        const result = JSON.parse(data);
        if (result.errcode == 0 && result.data && result.data.link) {
          $.log(`\n🌝账号${ac.no}获取key回执成功，第${count}次跳转观看💦`);
          let jumpObj = await ysm2(ac, result.data.link);
          if (jumpObj) {
            let time = parseInt(Math.random() * (12 - 8 + 1) + 8, 10);
            $.log(`🌝账号${ac.no}等待${time}秒后提交本次观看, jump接口结果：\n${JSON.stringify(jumpObj, null, 2)}`);
            await $.wait(time * 1000);
            await ysm3(ac, time);
            f = 1;
          }
        } else {
          f = 0;
          $.log(`🚫账号${ac.no}获取key回执失败：${(result.data && result.data.msg) || result.msg}`);
        }
      } catch (e) {
        $.log(`=================账号 ${ac.no}：\nurl: ${opts.url}\ndata: ${resp && resp.body}`);
        $.logErr(e, resp);
      } finally {
        resolve(f);
      }
    })
  })
}

function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),a={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(a,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.post(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="POST",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.post(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}time(t){let e={"M+":(new Date).getMonth()+1,"d+":(new Date).getDate(),"H+":(new Date).getHours(),"m+":(new Date).getMinutes(),"s+":(new Date).getSeconds(),"q+":Math.floor(((new Date).getMonth()+3)/3),S:(new Date).getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,((new Date).getFullYear()+"").substr(4-RegExp.$1.length)));for(let s in e)new RegExp("("+s+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?e[s]:("00"+e[s]).substr((""+e[s]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r)));let h=["","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];h.push(e),s&&h.push(s),i&&h.push(i),console.log(h.join("\n")),this.logs=this.logs.concat(h)}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}
