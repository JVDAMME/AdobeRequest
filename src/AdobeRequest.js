(function(root, factory) {
    if (typeof define === "function" && define.amd) {
      define(["AdobeRequest"], factory);
    } else if (typeof exports === "object") {
      module.exports = factory();
    } else {
      root.AdobeRequest = factory();
    }
  })(this || self || window, function() {
    function AdobeRequest(settings) {
      if (!(this instanceof AdobeRequest)) {
        throw "Pleae instantiate with new, funcional use unsupported.";
      }
      //reserved parameters
      this._reserved = {
        D: { out: "D", reserved: true },
        campaign: { out: "v0", reserved: true },
        channel: { out: "ch", reserved: true },
        events: { out: "ev", reserved: true },
        event: {
          out: "pev2",
          reserved: true,
          trans: function(k, v, o) {
            o["pe"] = "lnk_o";
            o["c.a.Action"] = v;
            return v;
          }
        },
        url: { out: "g", reserved: true },
        referrer: { out: "r", reserved: true },
        visitornamespace: { out: "ns", reserved: true },
        pagename: { out: "gn", reserved: true },
        server: { out: "sv", reserved: true },
        timestamp: { out: "ts", reserved: true },
        msisdn: {
          out: "msisdn",
          trans: function(k, v, o) {
            return !isMD5Encrypted(v) ? md5(v) : v;
          }
        },
        customerid: {
          out: "customerid",
          trans: function(k, v, o) {
            return !isSHA256ENcrypted(v) ? sha256(v) : v;
          }
        },
        visitorid: {
          out: "vid",
          reserved: true,
          trans: function(k, v, o) {
            var val = v.replace(/-/gm, "");
            o["c.vid"] = val;
            return val;
          }
        },
        appid: { out: "c.a.AppId", reserved: true },
        osversion: { out: "c.a.OSVersion", reserved: true },
        devicename: { out: "c.a.DeviceName", reserved: true },
        carriername: { out: "c.a.CarrierName", reserved: true },
        installevent: { out: "c.a.InstallEvent", reserved: true },
        installdate: { out: "c.a.InstallDate", reserved: true },
        launchevent: { out: "c.a.LaunchEvent", reserved: true },
        crashevent: { out: "c.a.CrashEvent", reserved: true }
      };
      //expand reserved keywords with props and evars, just n case someone adds a prop or evar to the data input
      for (var index = 0; index < 100; index++) {
        var idx = index + 1;
        this._reserved["prop" + idx] = { reserved: true, out: "c" + idx };
        this._reserved["evar" + idx] = { reserved: true, out: "v" + idx };
      }
      this._persist = {};
      this.settings = settings || {};
      this.settings.convertToLowercase = this.settings.convertToLowercase || true;
      this.settings.reportorgid = this.settings.reportorgid || "?";
      this.settings.reportserver = this.settings.reportserver || "?";
      this.settings.reportnamespace = this.settings.reportnamespace || "?";
      this.settings.reportsuite = this.settings.reportsuite || "?";
      this.settings.debug = this.settings.debug || false;
      this.enableDebug(this.settings.debug);
  
      //dynamically construct the base url upon access, cannot be set
      Object.defineProperty(this, "baseUrl", {
        get: function() {
          return "https://"+[
            this.settings.reportserver,
            "b",
            "ss",
            this.settings.reportsuite,
            "5",
            getRandom()
          ].join("/");
        },
        set: function(newValue) {
          //console.warn("nope");
        },
        enumerable: true,
        configurable: true
      });
    }
    //add methods to the prototype
    var ARproto = AdobeRequest.prototype;
    ARproto.log = function() {};
    ARproto.enableDebug = function enableDebug(fn) {
        var input = fn || this.settings.debug;
      if (!!input) {
          if(typeof input == "function"){
            return (this.log = this.settings.debug = input), this;
          }
          this.log = console.log.bind(console);
      }
      return this;
    };
    ARproto.persist = function persist(data) {
      if (!!data) {
        data = this.toLowerCaseKeys(data) || {};
        this._persist = this.blend(true, {}, this._persist, data);
      }
      return this;
    };
    ARproto.transformer = function transformer(data) {
      if (!data.ts || !data.timestamp) {
        data.timestamp = getRandom();
      }
      var out = {};
      var dt = this.blend(true, {}, this._persist, data);
      if (!!!dt["visitorid"]) {
        this.log("Warning visitorid missing, generated one...");
        var vid = getRandom();
        this.persist({ visitorid: vid });
        dt.visitorid = vid;
      }
      dt = this.flatAndLow(dt);
      dt["D"] = "~";
      for (var key in dt) {
        var value = dt[key];
        if (!!!value) {
            this.log('key '+key+' skipped, empty value');
            continue;
        }
        var key_split = key.split(".");
        var actual_key = key_split.pop();
        var res = undefined;
        if ((res = this._reserved[actual_key])) {
          if (res.out) {
            actual_key = res.out;
            this.log('key '+key+': new key '+actual_key);
        }
          if (!res.reserved) {
            key_split.unshift("c");
          }
          if (res.trans && typeof res.trans == "function") {
            var new_value = res.trans(key, value, out);
            value != new_value && this.log('key '+key+': value '+ value +' replaced by '+new_value);
            value = new_value;
          }
        } else {
          key_split.unshift("c");
        }
        key_split.push(actual_key);
        actual_key = key_split.join(".");
        value = escape(value);
        out[actual_key] = value;
      }
      this.log('Transformed object:',out);     
      var o = [];
      var kz = Object.keys(out).sort();
      for (var i = 0; i < kz.length; i++) {
        var k = kz[i];
        o.push(k + "=" + out[k]);
      }
      return o.join("&");
    };
    ARproto.flatAndLow = function flatAndLow(data) {
      var o = {};
      var skey = [];
      for (var key in data) {
        var v = data[key];
        recurse(key, v);
      }
      return o;
      function recurse(k, v) {
        if (isObject(v)) {
          if (!isEmptyObject(v)) {
            skey.push(k);
            for (var key in v) {
              recurse(key, v[key]);
            }
            skey.pop();
          }
        } else {
          var key_pre = skey.join(".");
          key_pre = !!key_pre ? key_pre + "." : "";
          var kl = (key_pre + k).toLowerCase();
          o[kl] = v;
        }
      }
    };
  
    ARproto.getQS = function getQS(data) {
      return this.transformer(data);
    };
    ARproto.getUrl = function getUrl(data) {
      return this.baseUrl + "?" + this.getQS(data);
    };
    ARproto.getBaseUrl = function getBaseUrl() {
      return this.baseUrl;
    };
    ARproto.toLowerCaseKeys = function toLowerCaseKeys(data) {
      return JSON.parse(
        JSON.stringify(data).replace(/"([^"]+)":/g, function($0, key) {
          return '"' + key.toString().toLowerCase() + '":';
        })
      );
    };
    //prettier-ignore
    ARproto.blend=function(){var e=function(e){return!("object"!=typeof e||e&&e.nodeType||null!==e&&e===e.window||e&&e.constructor&&!Object.prototype.hasOwnProperty.call(e.constructor.prototype,"isPrototypeOf"))},n=function(e){for(var n=e.concat(),o=0;o<n.length;++o)for(var t=o+1;t<n.length;++t)n[o]===n[t]&&n.splice(t--,1);return n},o=function(t){var r=1,c=!1,f=!1,a=typeof t;return"boolean"===a&&(c=t,t=arguments[1]||{},r++,"boolean"==typeof t&&(f=t,t=arguments[2]||{},r++)),[].slice.call(arguments,r).forEach(function(r){var a,i,u,p;if(r!==t)if(c&&r instanceof Array)t=f?n(t.concat(r)):t.concat(r);else for(var l in r)a=t[l],i=r[l],t!==i&&a!==i&&((u=i instanceof Array)||c&&i&&e(i)?(p=u?a&&a instanceof Array?a:[]:a&&e(a)?a:{},u=!1,f?t[l]=o(c,f,p,i):t[l]=o(c,p,i)):void 0!==i&&(t[l]=i))}),t};return o}();
  
    //utility to check if object is empty
    function isEmptyObject(obj) {
      return Object.getOwnPropertyNames(obj).length === 0;
    }
    //uility to check if input is an object (but not an array)
    function isObject(obj) {
      return (
        obj === Object(obj) &&
        Object.prototype.toString.call(obj) !== "[object Array]"
      );
    }
    //cachebusting
    function getRandom() {
      return Math.round(new Date().getTime() / 1000);
    }
    //basic encryption mechanism MD5
    //prettier-ignore
    var md5=function(){for(var m=[],l=0;64>l;)m[l]=0|4294967296*Math.abs(Math.sin(++l));return function(c){var e,g,f,a,h=[];c=unescape(encodeURI(c));for(var b=c.length,k=[e=1732584193,g=-271733879,~e,~g],d=0;d<=b;)h[d>>2]|=(c.charCodeAt(d)||128)<<8*(d++%4);h[c=16*(b+8>>6)+14]=8*b;for(d=0;d<c;d+=16){b=k;for(a=0;64>a;)b=[f=b[3],(e=b[1]|0)+((f=b[0]+[e&(g=b[2])|~e&f,f&e|~f&g,e^g^f,g^(e|~f)][b=a>>4]+(m[a]+(h[[a,5*a+1,3*a+5,7*a][b]%16+d]|0)))<<(b=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21][4*b+a++%4])|f>>>32-b),e,g];for(a=4;a;)k[--a]=k[a]+b[a]}for(c="";32>a;)c+=(k[a>>3]>>4*(1^a++&7)&15).toString(16);return c}}();
    //basic encryption mechanism SHA256
    //prettier-ignore
    var sha256=function(){function e(a,b){return a>>>b|a<<32-b}for(var b=1,a,m=[],n=[];18>++b;)for(a=b*b;312>a;a+=b)m[a]=1;b=1;for(a=0;313>b;)m[++b]||(n[a]=Math.pow(b,.5)%1*4294967296|0,m[a++]=Math.pow(b,1/3)%1*4294967296|0);return function(g){for(var l=n.slice(b=0),c=unescape(encodeURI(g)),h=[],d=c.length,k=[],f,p;b<d;)k[b>>2]|=(c.charCodeAt(b)&255)<<8*(3-b++%4);d*=8;k[d>>5]|=128<<24-d%32;k[p=d+64>>5|15]=d;for(b=0;b<p;b+=16){for(c=l.slice(a=0,8);64>a;c[4]+=f)h[a]=16>a?k[a+b]:(e(f=h[a-2],17)^e(f,19)^f>>>10)+(h[a-7]|0)+(e(f=h[a-15],7)^e(f,18)^f>>>3)+(h[a-16]|0),c.unshift((f=(c.pop()+(e(g=c[4],6)^e(g,11)^e(g,25))+((g&c[5]^~g&c[6])+m[a])|0)+(h[a++]|0))+(e(d=c[0],2)^e(d,13)^e(d,22))+(d&c[1]^c[1]&c[2]^c[2]&d));for(a=8;a--;)l[a]=c[a]+l[a]}for(c="";63>a;)c+=(l[++a>>3]>>4*(7-a%8)&15).toString(16);return c}}();
    //check if something is md5 encrypted
    function isMD5Encrypted(inputString) {
      return /[a-fA-F0-9]{32}/.test(inputString);
    }
    function isSHA256ENcrypted(inputString) {
      return /\b[A-Fa-f0-9]{64}\b/.test(inputString);
    }
    return AdobeRequest;
  });
