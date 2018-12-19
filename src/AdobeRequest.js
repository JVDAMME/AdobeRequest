(function(root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["AdobeRequest"], factory);
  } else if (typeof exports === "object") {
    module.exports = factory();
  } else {
    root.AdobeRequest = factory();
  }
})(this || self || window, function() {
    //this code is of alpha quality
    // it has not been battle tested so expect some bugs
    //sorry about that, time constraints have prevented extensive testing
  //the reserved parameters and translation to qs parameters
  var reserved = {
    campaign: "v0",
    channel: "ch",
    events: "ev",
    event: "pev2",
    url: "g",
    referrer: "r",
    visitornamespace: "ns",
    pagename: "gn",
    server: "server",
    timestamp: "ts",
    visitorid: "vid",
    appid: "c.a.AppId",
    osversion: "c.a.OSVersion",
    devicename: "c.a.DeviceName",
    carriername: "c.a.CarrierName",
    installevent: "c.a.InstallEvent",
    installdate: "c.a.InstallDate",
    launchevent: "c.a.LaunchEvent",
    crashevent: "c.a.CrashEvent"
  };

  //main 
  function AdobeRequest(settings) {
    if(!(this instanceof AdobeRequest)){
        var s = {};
        for (var key in settings) {
            if (settings.hasOwnProperty(key) && isSetting()) {
                s[key]= settings[key];
                delete(settings[key]);
            }
        }
        return new AdobeRequest(s).getUrl(settings);
    }
    this._persist = {};
    this.settings = settings || {};
    this.settings.convertToLowercase = this.settings.convertToLowercase || true;
    this.settings.reportorgid = this.settings.reportorgid || "?";
    this.settings.reportserver = this.settings.reportserver || "?";
    this.settings.reportnamespace = this.settings.reportnamespace || "?" || "proximus";
    this.settings.reportsuite = this.settings.reportsuite || "?";
    this.settings.debug = this.settings.debug || false;
    if(this.settings.debug){
        this.enableDebug()
    }
    //dynamically construct the base url upon access, cannot be set
    Object.defineProperty(this, "baseUrl", {
      get: function() {
        return [
          "https:\\",
          this.settings.reportserver,
          "b",
          "ss",
          this.settings.reportsuite,
          "5",
          getRandom()
        ].join("\\");
      },
      set: function(newValue) {
        console.warn("nope");
      },
      enumerable: true,
      configurable: true
    });
  }
  //add methods to the prototype
  var ARproto = AdobeRequest.prototype;
  ARproto.log = function() {};
  ARproto.enableDebug = function enableDebug(fn){
      var cb = !!fn || console.log.bind(console);
      this.log = cb;
  }
  ARproto.persist = function persist(data){
      if(!!data){
        data = JSONKeysToLowerCase(data) || {};
        data = mergeObjects(this._persist,data);
        this._persist = data;
      }
      return this._persist;
  }
  ARproto.getBaseUrl = function getBaseUrl(){
    return this.baseUrl;
  };
  
  ARproto.getQuerystring = function getQuerystring(data){
    //lowerCase all the keys
    var dt = JSONKeysToLowerCase(data) ||{};
    var merged = mergeObjects(this.persist(),dt);
    //transform the data into aworkable format
    var o = this.transformData(merged);
    //get the querystring format
    var querystring = this.otoqs(o);
    this.log("data after querystring processing", querystring);
    return querystring;
  };
  ARproto.transformData = function transformData(data){
    var o = {};
    for (var k in data) {
      var key = k;
      if (!!!data[key]) {
        //exclude empty parameters
        continue;
      }
      if(isSetting(key)){
        //remove data that is a setting
        continue;
      }
      if (!!!data['visitorid']) {
        //exclude empty parameters
        this.log("visitorid missing,abort");
        return undefined;
      }
      //convert prop1,prop2 etc to the proper qs variable
      if (k.indexOf("prop") == 0) {
        var tempkey = key.split("prop");
        if (tempkey[1] && !isNaN(tempkey[1])) {
          key = "c" + tempkey[1];
        }
      }
      //convert evar1,evar2 etc to the proper qs variable
      if (k.indexOf("evar") == 0) {
        var tempkey = key.split("evar");
        if (tempkey[1] && !isNaN(tempkey[1])) {
          key = "v" + tempkey[1];
        }
      }
      //defining an event needs an additional variable added
      if (k == "event") {
        !!!o["pe"] && (o["pe"] = "lnk_o");
      }
      //make sure the value is escaped and lowercased properly for string based values
      var dt = data[k];
      //check for reserved keys and translate them properly
      if (reserved[key]) {
        this.log("reserved key", k, "is now", reserved[k]);
        o[reserved[k]] = dt;
      } else {
        o[key] = dt;
      }
    }
    o = unflatten(o);
    if(!!!o.ts){
        this.log('timestamp missing generating one');
        o.ts = getRandom();
    }
    this.log("data after processing", o);
    return o;
  };
  ARproto.getUrl = function toUrl(data) {
    var qs = this.getQuerystring(data);
    var bs = this.getBaseUrl();
    //return a proper url
    return [bs, qs].join("?");
  };
  ARproto.otoqs = function otoqs(o) {
    //qs starts with the following variables
    var qs = [
      {
        key: "AQB",
        value: "1"
      },
      {
        key: "ndh",
        value: "1"
      }
    ];

    for (var k in o) {
      toqs(k, o, qs,this.settings);
    }
    qs.push({key:'D',value:'d'});
    
    //qs ends with this variable
    qs.push({
      key: "AQE",
      value: "1"
    });
    var xs = [];
    for (var i = 0; i < qs.length; i++) {
      var s = "";
      var k = qs[i].key;
      var v = qs[i].value;
      s += k;
      !!v && (s += "=" + v);
      xs.push(s);
    }
    //join the key value pairs
    xs = xs.join("&");
    return xs;
  };

  //utility to recursively go through an object and create a proper array with namespacing according to the adobe specs
  function toqs(k, o, out,settings) {
    if (isObject(o[k])) {
      out.push({
        key: k + "."
      });
      for (var key in o[k]) {
        toqs(key, o[k], out,settings);
      }
      out.push({
        key: "." + k
      });
    } else {
        //customer id and msisdn should be encrypted for gdpr purposes!
        if(k == 'msisdn' && !isMD5Encrypted(o[k])){
                o[k] = md5(o[k]);
          }
          if(k == 'customerid' && !isSHA256ENcrypted(o[k])){
             o[k] = sha256(o[k]);
       }
      out.push({
        key: k,
        value: !!settings && !!settings.convertToLowercase ? escape((o[k]+'').toLowerCase()) : escape((o[k])+'')
      });
    }
    return out;
  }
  //explode key value pairs with a dot in the key to become a proper json tree
  function unflatten(data) {
    if (Object(data) !== data || Array.isArray(data)) {
      return data;
    }
    var p;
    var regex = /\.?([^.\[\]]+)|\[(\d+)\]/g;
    var resultholder = {};
    for (p in data) {
      var cur = resultholder;
      var prop = "";
      var m;
      while ((m = regex.exec(p))) {
        cur = cur[prop] || (cur[prop] = m[2] ? [] : {});
        prop = m[2] || m[1];
      }
      isObject(cur) && (cur[prop] = data[p]);
    }
    return resultholder[""] || resultholder;
  }
  //lowercase all keys of an object
  function JSONKeysToLowerCase(data) {
    return JSON.parse(JSON.stringify(data)
     .replace(/"([^"]+)":/g, function($0, key){
       return '"' + key.toString().toLowerCase() + '":'
     }))
  }
  //uility to check if input is an object (but not an array)
  function isObject(obj) {
    return (
      obj === Object(obj) &&
      Object.prototype.toString.call(obj) !== "[object Array]"
    );
  }
  //merge two objects recursively
  function mergeObjects(object1, object2) {
    var key;
  
    // concatenate not objects into arrays
    if (typeof object1 !== 'object') {
      if (typeof object2 !== 'object') {
        return [object1, object2];
      }
      return object2.concat(object1);
    }
    if (typeof object2 !== 'object') {
      return object1.concat(object2);
    }
  
    // merge object2 into object1
    for (key in object2) {
      if ((Array.isArray(object1[key])) && (Array.isArray(object2[key]))) {
        // concatenate arrays that are values of the same object key
        object1[key] = object1[key].concat(object2[key]);
      } else if (typeof object1[key] === 'object' && typeof object2[key] === 'object') {
        // deep merge object2 into object1
        object1[key] = mergeObjects(object1[key], object2[key]);
      } else {
        object1[key] = object2[key];
      }
    }
    return object1;
  };
  //cachebusting
  function getRandom(){
      return Math.round((new Date()).getTime()/1000);
  }
    //basic encryption mechanism MD5
    var md5=function(){for(var m=[],l=0;64>l;)m[l]=0|4294967296*Math.abs(Math.sin(++l));return function(c){var e,g,f,a,h=[];c=unescape(encodeURI(c));for(var b=c.length,k=[e=1732584193,g=-271733879,~e,~g],d=0;d<=b;)h[d>>2]|=(c.charCodeAt(d)||128)<<8*(d++%4);h[c=16*(b+8>>6)+14]=8*b;for(d=0;d<c;d+=16){b=k;for(a=0;64>a;)b=[f=b[3],(e=b[1]|0)+((f=b[0]+[e&(g=b[2])|~e&f,f&e|~f&g,e^g^f,g^(e|~f)][b=a>>4]+(m[a]+(h[[a,5*a+1,3*a+5,7*a][b]%16+d]|0)))<<(b=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21][4*b+a++%4])|f>>>32-b),e,g];for(a=4;a;)k[--a]=k[a]+b[a]}for(c="";32>a;)c+=(k[a>>3]>>4*(1^a++&7)&15).toString(16);return c}}();
    //basic encryption mechanism SHA256
    var sha256=function(){function e(a,b){return a>>>b|a<<32-b}for(var b=1,a,m=[],n=[];18>++b;)for(a=b*b;312>a;a+=b)m[a]=1;b=1;for(a=0;313>b;)m[++b]||(n[a]=Math.pow(b,.5)%1*4294967296|0,m[a++]=Math.pow(b,1/3)%1*4294967296|0);return function(g){for(var l=n.slice(b=0),c=unescape(encodeURI(g)),h=[],d=c.length,k=[],f,p;b<d;)k[b>>2]|=(c.charCodeAt(b)&255)<<8*(3-b++%4);d*=8;k[d>>5]|=128<<24-d%32;k[p=d+64>>5|15]=d;for(b=0;b<p;b+=16){for(c=l.slice(a=0,8);64>a;c[4]+=f)h[a]=16>a?k[a+b]:(e(f=h[a-2],17)^e(f,19)^f>>>10)+(h[a-7]|0)+(e(f=h[a-15],7)^e(f,18)^f>>>3)+(h[a-16]|0),c.unshift((f=(c.pop()+(e(g=c[4],6)^e(g,11)^e(g,25))+((g&c[5]^~g&c[6])+m[a])|0)+(h[a++]|0))+(e(d=c[0],2)^e(d,13)^e(d,22))+(d&c[1]^c[1]&c[2]^c[2]&d));for(a=8;a--;)l[a]=c[a]+l[a]}for(c="";63>a;)c+=(l[++a>>3]>>4*(7-a%8)&15).toString(16);return c}}();  
    //check if something is md5 encrypted
    function isMD5Encrypted(inputString) {
      return (/[a-fA-F0-9]{32}/).test(inputString);
    }
    function isSHA256ENcrypted(inputString){
        return (/\b[A-Fa-f0-9]{64}\b/).test(inputString);
    }
    function isSetting(key){
        return (key.indexOf('report')==0 && key.length>7) || key=='debug';
    }
  //return to global, export 'function'
  return AdobeRequest;
});