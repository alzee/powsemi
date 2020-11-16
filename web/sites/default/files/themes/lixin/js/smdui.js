/*
@license
smd UI v.1.0.0
亿饶软件
*/
if (!window.smdui) 
	smdui={};

//check some rule, show message as error if rule is not correct
smdui.assert = function(test, message){
	if (!test){
		smdui.assert_error(message);
	}
};

smdui.assert_config = function(obj){
	var coll = obj.cells || obj.rows || obj.elements || obj.cols;
	if (coll)
		for (var i=0; i<coll.length; i++)
			if (coll[i] === null || typeof coll[i] === "undefined")
				smdui.assert_error("You have trailing comma or Null element in collection's configuration");
};

smdui.assert_error = function(message){
	//jshint debug:true
	smdui.log("error",message);
	if (smdui.message && typeof message == "string")
		smdui.message({ type:"debug", text:message, expire:-1 });
	if (smdui.debug !== false)
		debugger;
};

//entry point for analitic scripts
smdui.assert_core_ready = function(){
	if (window.smdui_on_core_ready)	
		window.smdui_on_core_ready();
};

smdui.assert_level = 0;

smdui.assert_level_in = function(){
	smdui.assert_level++;
	if (smdui.assert_level == 100)
		smdui.assert_error("Attempt to copy object with self reference");
};
smdui.assert_level_out = function(){
	smdui.assert_level--;
};

/*
	Common helpers
*/
smdui.version="1.0.0";
smdui.codebase="./";
smdui.name = "core";
smdui.cdn = "//cdn.smdui.com";

//coding helpers
smdui.clone = function(source){
	var f = smdui.clone._function;
	f.prototype = source;
	return new f();
};
smdui.clone._function = function(){};

//copies methods and properties from source to the target
smdui.extend = function(base, source, force){
	smdui.assert(base,"Invalid mixing target");
	smdui.assert(source,"Invalid mixing source");

	if (base.$protoWait){
		smdui.PowerArray.insertAt.call(base.$protoWait, source,1);
		return base;
	}
	
	//copy methods, overwrite existing ones in case of conflict
	for (var method in source)
		if ((!(method in base)) || force)
			base[method] = source[method];
		
	//in case of defaults - preffer top one
	if (source.defaults)
		smdui.extend(base.defaults, source.defaults);
	
	//if source object has init code - call init against target
	if (source.$init)	
		source.$init.call(base);
				
	return base;	
};

//copies methods and properties from source to the target from all levels
smdui.copy = function(source){
	smdui.assert(source,"Invalid mixing target");
	smdui.assert_level_in();

	var target;
	if(arguments.length>1){
		target = arguments[0];
		source = arguments[1];
	} else 
		target = (smdui.isArray(source)?[]:{});

	for (var method in source){
		var from = source[method];
		if(from && typeof from == "object" && !(from instanceof RegExp)){
			if (!smdui.isDate(from)){
				target[method] = (smdui.isArray(from)?[]:{});
				smdui.copy(target[method],from);
			} else
				target[method] = new Date(from);
		} else {
			target[method] = from;
		}
	}

	smdui.assert_level_out();
	return target;	
};

smdui.single = function(source){ 
	var instance = null;
	var t = function(config){
		if (!instance)
			instance = new source({});
			
		if (instance._reinit)
			instance._reinit.apply(instance, arguments);
		return instance;
	};
	return t;
};

smdui.protoUI = function(){
	if (smdui.debug_proto)
		smdui.log("UI registered: "+arguments[0].name);
		
	var origins = arguments;
	var selfname = origins[0].name;
	
	var t = function(data){
		if (!t)
			return smdui.ui[selfname].prototype;

		var origins = t.$protoWait;
		if (origins){
			var params = [origins[0]];
			
			for (var i=1; i < origins.length; i++){
				params[i] = origins[i];

				if (params[i].$protoWait)
					params[i] = params[i].call(smdui, params[i].name);

				if (params[i].prototype && params[i].prototype.name)
					smdui.ui[params[i].prototype.name] = params[i];
			}
			smdui.ui[selfname] = smdui.proto.apply(smdui, params);

			if (t._smdui_type_wait)	
				for (var i=0; i < t._smdui_type_wait.length; i++)
					smdui.type(smdui.ui[selfname], t._smdui_type_wait[i]);
				
			t = origins = null;	
		}
			
		if (this != smdui)
			return new smdui.ui[selfname](data);
		else 
			return smdui.ui[selfname];
	};
	t.$protoWait = Array.prototype.slice.call(arguments, 0);
	return (smdui.ui[selfname]=t);
};

smdui.proto = function(){
	 
	if (smdui.debug_proto)
		smdui.log("Proto chain:"+arguments[0].name+"["+arguments.length+"]");

	var origins = arguments;
	var compilation = origins[0];
	var has_constructor = !!compilation.$init;
	var construct = [];
	
	smdui.assert(compilation,"Invalid mixing target");
		
	for (var i=origins.length-1; i>0; i--) {
		smdui.assert(origins[i],"Invalid mixing source");
		if (typeof origins[i]== "function")
			origins[i]=origins[i].prototype;
		if (origins[i].$init) 
			construct.push(origins[i].$init);
		if (origins[i].defaults){ 
			var defaults = origins[i].defaults;
			if (!compilation.defaults)
				compilation.defaults = {};
			for (var def in defaults)
				if (smdui.isUndefined(compilation.defaults[def]))
					compilation.defaults[def] = defaults[def];
		}
		if (origins[i].type && compilation.type){
			for (var def in origins[i].type)
				if (!compilation.type[def])
					compilation.type[def] = origins[i].type[def];
		}
			
		for (var key in origins[i]){
			if (!compilation[key] && compilation[key] !== false)
				compilation[key] = origins[i][key];
		}
	}
	
	if (has_constructor)
		construct.push(compilation.$init);
	
	
	compilation.$init = function(){
		for (var i=0; i<construct.length; i++)
			construct[i].apply(this, arguments);
	};
	if (compilation.$skin)
		compilation.$skin();

	var result = function(config){
		this.$ready=[];
		smdui.assert(this.$init,"object without init method");
		this.$init(config);
		if (this._parseSettings)
			this._parseSettings(config, this.defaults);
		for (var i=0; i < this.$ready.length; i++)
			this.$ready[i].call(this);
	};
	result.prototype = compilation;
	
	compilation = origins = null;
	return result;
};
//creates function with specified "this" pointer
smdui.bind=function(functor, object){ 
	return function(){ return functor.apply(object,arguments); };  
};

//loads module from external js file
smdui.require=function(module, callback, master){
	var promise = smdui.promise.defer();

	if (callback && callback !== true)
		promise = promise.then(function(){ callback.call(master || this); });

	if (smdui.require.disabled){
		promise.resolve();
		return promise;
	}

	//multiple files required at once
	if (typeof module != "string"){
		var count = module.length||0;
		
		if (!count){
			// { file: true, other: true }
			for (var file in module) count++;
			var callback2 = function(){
				count--;
				if (count === 0)
					promise.resolve();
			};
			for (var file in module)
				smdui.require(file, callback2, master);
		} else {
			// [ file, other ]
			var callback2 = function(){
				if (count){
					count--;
					smdui.require(module[module.length - count - 1], callback2, master);
				} else {
					promise.resolve();
				}
			};
			callback2();
		}
		return;
	}

	if (smdui._modules[module] !== true){
		var fullpath = module;
		if (!module.toString().match(/^([a-z]+\:)*\/\//i))
			fullpath = smdui.codebase + module;

		//css, async, no waiting
		if (module.substr(module.length-4) == ".css") {
			var link = smdui.html.create("LINK",{  type:"text/css", rel:"stylesheet", href:fullpath});
			document.getElementsByTagName('head')[0].appendChild(link);
			promise.resolve();
			return promise;
		}

		//js, async, waiting
		if (callback === true){
			//sync mode
			smdui.exec( smdui.ajax().sync().get(fullpath).responseText );
			smdui._modules[module]=true;

		} else {

			if (!smdui._modules[module]){	//first call
				smdui._modules[module] = [promise];

				smdui.ajax(fullpath, function(text){
					smdui.exec(text);	//evaluate code
					var calls = smdui._modules[module];	//callbacks
					smdui._modules[module] = true;
					for (var i=0; i<calls.length; i++)
						calls[i].resolve();
				});
			} else	//module already loading
				smdui._modules[module].push(promise);
		}
	} else 
		promise.resolve();

	return promise;
};
smdui._modules = {};	//hash of already loaded modules

//evaluate javascript code in the global scoope
smdui.exec=function(code){
	if (window.execScript)	//special handling for IE
		window.execScript(code);
	else window.eval(code);
};

smdui.wrap = function(code, wrap){
	if (!code) return wrap;
	return function(){
		var result = code.apply(this, arguments);
		wrap.apply(this,arguments);
		return result;
	};
};

//check === undefined
smdui.isUndefined=function(a){
	return typeof a == "undefined";
};
//delay call to after-render time
smdui.delay=function(method, obj, params, delay){
	return window.setTimeout(function(){
		if(!(obj&&obj.$destructed)){
			var ret = method.apply(obj,(params||[]));
			method = obj = params = null;
			return ret;
		}
	},delay||1);
};

smdui.once=function(method){
	var flag = true;
	return function(){
		if (flag){
			flag = false;
			method.apply(this, arguments);
		}
	};
};

//common helpers

//generates unique ID (unique per window, nog GUID)
smdui.uid = function(){
	if (!this._seed) this._seed=(new Date()).valueOf();	//init seed with timestemp
	this._seed++;
	return this._seed;
};
//resolve ID as html object
smdui.toNode = function(node){
	if (typeof node == "string") return document.getElementById(node);
	return node;
};
//adds extra methods for the array
smdui.toArray = function(array){ 
	return smdui.extend((array||[]),smdui.PowerArray, true);
};
//resolve function name
smdui.toFunctor=function(str, scope){ 
	if (typeof(str)=="string"){
		var method = str.replace("()","");
		if (scope && scope[method]) return scope[method];
		return window[method] || eval(str);
	}
	return str;
};
/*checks where an object is instance of Array*/
smdui.isArray = function(obj) {
	return Array.isArray?Array.isArray(obj):(Object.prototype.toString.call(obj) === '[object Array]');
};
smdui.isDate = function(obj){
	return obj instanceof Date;
};
// converts an object into a string with respect to dates
smdui.stringify = function(obj){
	var origin = Date.prototype.toJSON;
	Date.prototype.toJSON = function(){
		return smdui.i18n.parseFormatStr(this);
	};

	var result;
	if (obj instanceof Date)
		result = obj.toJSON();
	else
		result = JSON.stringify(obj);

	Date.prototype.toJSON = origin;
	return result;
};

//dom helpers

//hash of attached events
smdui._events = {};
//private version of API, do not register ID for event detaching
smdui._event = function(a,b,c,d){
	d = d || {};
	d.inner = true;
	smdui.event(a,b,c,d);
};
//attach event to the DOM element
smdui.event=function(node,event,handler,context){
	context = context || {};
	node = smdui.toNode(node);
	smdui.assert(node, "Invalid node as target for smdui.event");
	
	var id = context.id || smdui.uid();

	if(context.bind)
		handler=smdui.bind(handler,context.bind);

	var info = [node,event,handler,context.capture];
	if (!context.inner)
		smdui._events[id]=info;	//store event info, for detaching
		
	//use IE's of FF's way of event's attaching
	if (node.addEventListener)
		node.addEventListener(event, handler, !!context.capture);
	else if (node.attachEvent)
		node.attachEvent("on"+event, info[2] = function(){
			return handler.apply(node, arguments);	//IE8 fix
		});

	return id;	//return id of newly created event, can be used in eventRemove
};

//remove previously attached event
smdui.eventRemove=function(id){
	
	if (!id) return;
	smdui.assert(this._events[id],"Removing non-existing event");
		
	var ev = smdui._events[id];
	//browser specific event removing
	if (ev[0].removeEventListener)
		ev[0].removeEventListener(ev[1],ev[2],!!ev[3]);
	else if (ev[0].detachEvent)
		ev[0].detachEvent("on"+ev[1],ev[2]);

		
	delete this._events[id];	//delete all traces
};


//debugger helpers
//anything starting from error or log will be removed during code compression

//add message in the log
smdui.log = function(type,message,details){
	if (arguments.length == 1){
		message = type;
		type = "log";
	}
	/*jsl:ignore*/
	if (window.console && window.console.log){
		type=type.toLowerCase();
		if (window.console[type])
			window.console[type](message||"unknown error");
		else
			window.console.log(type +": "+message);

		if (details) 
			window.console.log(details);
	}	
	/*jsl:end*/
};
//register rendering time from call point 
smdui.log_full_time = function(name){
	smdui._start_time_log = new Date();
	smdui.log("Timing start ["+name+"]");
	window.setTimeout(function(){
		var time = new Date();
		smdui.log("Timing end ["+name+"]:"+(time.valueOf()-smdui._start_time_log.valueOf())/1000+"s");
	},1);
};
//register execution time from call point
smdui.log_time = function(name){
	var fname = "_start_time_log"+name;
	if (!smdui[fname]){
		smdui[fname] = new Date();
		smdui.log("Info","Timing start ["+name+"]");
	} else {
		var time = new Date();
		smdui.log("Info","Timing end ["+name+"]:"+(time.valueOf()-smdui[fname].valueOf())/1000+"s");
		smdui[fname] = null;
	}
};
smdui.debug_code = function(code){
	code.call(smdui);
};
//event system
smdui.EventSystem={
	$init:function(){
		if (!this._evs_events){
			this._evs_events = {};		//hash of event handlers, name => handler
			this._evs_handlers = {};	//hash of event handlers, ID => handler
			this._evs_map = {};
		}
	},
	//temporary block event triggering
	blockEvent : function(){
		this._evs_events._block = true;
	},
	//re-enable event triggering
	unblockEvent : function(){
		this._evs_events._block = false;
	},
	mapEvent:function(map){
		smdui.extend(this._evs_map, map, true);
	},
	on_setter:function(config){
		if(config){
			for(var i in config){
				var method = smdui.toFunctor(config[i], this.$scope);
				var sub = i.indexOf("->");
				if (sub !== -1){
					this[i.substr(0,sub)].attachEvent(i.substr(sub+2), smdui.bind(method, this));
				} else
					this.attachEvent(i, method);
			}
		}
	},
	//trigger event
	callEvent:function(type,params){
		if (this._evs_events._block) return true;
		
		type = type.toLowerCase();
		var event_stack =this._evs_events[type.toLowerCase()];	//all events for provided name
		var return_value = true;

		if (smdui.log)
			if ((smdui.debug || this.debug) && !smdui.debug_blacklist[type])	//can slowdown a lot
				smdui.log("info","["+this.name+"@"+((this._settings||{}).id)+"] event:"+type,params);
		
		if (event_stack)
			for(var i=0; i<event_stack.length; i++){
				/*
					Call events one by one
					If any event return false - result of whole event will be false
					Handlers which are not returning anything - counted as positive
				*/
				if (event_stack[i].apply(this,(params||[]))===false) return_value=false;
			}
		if (this._evs_map[type]){
			var target = this._evs_map[type];
			target.$eventSource = this;
			if (!target.callEvent(type,params))
				return_value =	false;
			target.$eventSource = null;
		}

		return return_value;
	},
	//assign handler for some named event
	attachEvent:function(type,functor,id){
		smdui.assert(functor, "Invalid event handler for "+type);

		type=type.toLowerCase();
		
		id=id||smdui.uid(); //ID can be used for detachEvent
		functor = smdui.toFunctor(functor, this.$scope);	//functor can be a name of method

		var event_stack=this._evs_events[type]||smdui.toArray();
		//save new event handler
		if (arguments[3])
			event_stack.unshift(functor);
		else
			event_stack.push(functor);
		this._evs_events[type]=event_stack;
		this._evs_handlers[id]={ f:functor,t:type };
		
		return id;
	},
	//remove event handler
	detachEvent:function(id){
		if(!this._evs_handlers[id]){
			var name = (id+"").toLowerCase();
			if (this._evs_events[name]){
				this._evs_events[name] = smdui.toArray();
			}
			return;
		}
		var type=this._evs_handlers[id].t;
		var functor=this._evs_handlers[id].f;
		
		//remove from all collections
		var event_stack=this._evs_events[type];
		event_stack.remove(functor);
		delete this._evs_handlers[id];
	},
	hasEvent:function(type){
		type=type.toLowerCase();
		var stack = this._evs_events[type];
		if (stack && stack.length) return true;

		var parent = this._evs_map[type];
		if (parent)
			return parent.hasEvent(type);
		return false;
	}
};

smdui.extend(smdui, smdui.EventSystem, true);

//array helper
//can be used by smdui.toArray()
smdui.PowerArray={
	//remove element at specified position
	removeAt:function(pos,len){
		if (pos>=0) this.splice(pos,(len||1));
	},
	//find element in collection and remove it 
	remove:function(value){
		this.removeAt(this.find(value));
	},	
	//add element to collection at specific position
	insertAt:function(data,pos){
		if (!pos && pos!==0)	//add to the end by default
			this.push(data);
		else {	
			var b = this.splice(pos,(this.length-pos));
			this[pos] = data;
			this.push.apply(this,b); //reconstruct array without loosing this pointer
		}
	},
	//return index of element, -1 if it doesn't exists
	find:function(data){ 
		for (var i=0; i<this.length; i++) 
			if (data==this[i]) return i;
		return -1; 
	},
	//execute some method for each element of array
	each:function(functor,master){
		for (var i=0; i < this.length; i++)
			functor.call((master||this),this[i]);
	},
	//create new array from source, by using results of functor 
	map:function(functor,master){
		for (var i=0; i < this.length; i++)
			this[i]=functor.call((master||this),this[i]);
		return this;
	}, 
	filter:function(functor, master){
		for (var i=0; i < this.length; i++)
			if (!functor.call((master||this),this[i])){
				this.splice(i,1);
				i--;
			}
		return this;
	}
};

smdui.env = {};

// smdui.env.transform 
// smdui.env.transition
(function(){
	smdui.env.strict = !!window.smdui_strict;
	smdui.env.https = document.location.protocol === "https:";

	var agent = navigator.userAgent;

	if (agent.indexOf("Mobile")!=-1 || agent.indexOf("Windows Phone")!=-1)
		smdui.env.mobile = true;
	if (smdui.env.mobile || agent.indexOf("iPad")!=-1 || agent.indexOf("Android")!=-1)
		smdui.env.touch = true;
	if (agent.indexOf('Opera')!=-1)
		smdui.env.isOpera=true;
	else{
		//very rough detection, but it is enough for current goals
		smdui.env.isIE=!!document.all || (agent.indexOf("Trident") !== -1);
		if (smdui.env.isIE){
			var version = parseFloat(navigator.appVersion.split("MSIE")[1]);
			if (version == 8)
				smdui.env.isIE8 = true;
		}
		smdui.env.isEdge=(agent.indexOf("Edge")!=-1);
		smdui.env.isFF=(agent.indexOf("Firefox")!=-1);
		smdui.env.isWebKit=(agent.indexOf("KHTML")!=-1);
		smdui.env.isSafari=smdui.env.isWebKit && (agent.indexOf('Mac')!=-1) && (agent.indexOf('Chrome')==-1);

		//maximum height/width for HTML elements in pixels (rough), bigger values will be ignored by browser
		if(smdui.env.isIE || smdui.env.isEdge || smdui.env.isFF)
			smdui.env.maxHTMLElementSize = 10000000;
		if(smdui.env.isSafari)
			smdui.env.maxHTMLElementSize = 100000000;
	}

	if(agent.toLowerCase().indexOf("android")!=-1){
		smdui.env.isAndroid = true;
		if(agent.toLowerCase().indexOf("trident")){
			smdui.env.isAndroid = false;
			smdui.env.isIEMobile = true;
		}
	}

	smdui.env.transform = false;
	smdui.env.transition = false;

	var found_index = -1;
	var js_list =  ['', 'webkit', 'Moz', 'O', 'ms'];
	var css_list = ['', '-webkit-', '-Moz-', '-o-', '-ms-'];

	
	var d = document.createElement("DIV");
	for (var j=0; j < js_list.length; j++) {
		var name = js_list[j] ? (js_list[j]+"Transform") : "transform";
		if(typeof d.style[name] != 'undefined'){
			found_index = j;
			break;
		}
	}


	if (found_index > -1){
		smdui.env.cssPrefix = css_list[found_index];
		var jp = smdui.env.jsPrefix = js_list[found_index];

		smdui.env.transform = jp ? jp+"Transform" : "transform";
		smdui.env.transition = jp ? jp+"Transition" : "transition";
		smdui.env.transitionDuration = jp ? jp+"TransitionDuration" : "transitionDuration";

		d.style[smdui.env.transform] = "translate3d(0,0,0)";
		smdui.env.translate = (d.style[smdui.env.transform])?"translate3d":"translate";
		smdui.env.transitionEnd = ((smdui.env.cssPrefix == '-Moz-')?"transitionend":(jp ? jp+"TransitionEnd" : "transitionend"));
	}

	smdui.env.pointerevents = (!smdui.env.isIE ||(new RegExp("Trident/.*rv:11")).exec(agent) !== null);
})();


smdui.env.svg = (function(){
	return document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1");
})();

smdui.env.svganimation = (function(){
	return document.implementation.hasFeature("https://www.w3.org/TR/SVG11/feature#SVG-animation", "1.1");
})();


//html helpers
smdui.html={
	_native_on_selectstart:0,
	_style_element:{},
	denySelect:function(){
		if (!smdui._native_on_selectstart)
			smdui._native_on_selectstart = document.onselectstart;
		document.onselectstart = smdui.html.stopEvent;
	},
	allowSelect:function(){
		if (smdui._native_on_selectstart !== 0){
			document.onselectstart = smdui._native_on_selectstart||null;
		}
		smdui._native_on_selectstart = 0;

	},
	index:function(node){
		var k=0;
		//must be =, it is not a comparation!
		while ((node = node.previousSibling)) k++;
		return k;
	},
	_style_cache:{},
	createCss:function(rule, sufix){
		var text = "";
			sufix = sufix || "";

		for (var key in rule)
			text+= key+":"+rule[key]+";";
		
		var name = this._style_cache[text+sufix];
		if (!name){
			name = "s"+smdui.uid();
			this.addStyle("."+name+(sufix||"")+"{"+text+"}");
			this._style_cache[text+sufix] = name;
		}
		return name;
	},
	addStyle:function(rule, group){
		var style = group ? this._style_element[group] :this._style_element["default"];
		if(!style){
			style = document.createElement("style");
			style.setAttribute("type", "text/css");
			style.setAttribute("media", "screen,print");
			document.getElementsByTagName("head")[0].appendChild(style);

			if (group)
				this._style_element[group] = style;
			else
				this._style_element["default"] = style;
		}
		/*IE8*/
		if (style.styleSheet)
			style.styleSheet.cssText += rule;
		else
			style.appendChild(document.createTextNode(rule));
	},
	removeStyle:function(group){
		var box = this._style_element[group||"default"];
		if (box)
			box.innerHTML = "";
	},
	create:function(name,attrs,html){
		attrs = attrs || {};
		var node = document.createElement(name);
		for (var attr_name in attrs)
			node.setAttribute(attr_name, attrs[attr_name]);
		if (attrs.style)
			node.style.cssText = attrs.style;
		if (attrs["class"])
			node.className = attrs["class"];
		if (html)
			node.innerHTML=html;
		return node;
	},
	//return node value, different logic for different html elements
	getValue:function(node){
		node = smdui.toNode(node);
		if (!node) return "";
		return smdui.isUndefined(node.value)?node.innerHTML:node.value;
	},
	//remove html node, can process an array of nodes at once
	remove:function(node){
		if (node instanceof Array)
			for (var i=0; i < node.length; i++)
				this.remove(node[i]);
		else if (node && node.parentNode)
			node.parentNode.removeChild(node);
	},
	//insert new node before sibling, or at the end if sibling doesn't exist
	insertBefore: function(node,before,rescue){
		if (!node) return;
		if (before && before.parentNode)
			before.parentNode.insertBefore(node, before);
		else
			rescue.appendChild(node);
	},
	//return custom ID from html element 
	//will check all parents starting from event's target
	locate:function(e,id){
		var trg;
		if (e.tagName)
			trg = e;
		else {
			e=e||event;
			trg=e.target||e.srcElement;
		}
		
		while (trg){
			if (trg.getAttribute){	//text nodes has not getAttribute
				var test = trg.getAttribute(id);
				if (test) return test;
			}
			trg=trg.parentNode;
		}	
		return null;
	},
	//returns position of html element on the page
	offset:function(elem) {
		if (elem.getBoundingClientRect) { //HTML5 method
			var box = elem.getBoundingClientRect();
			var body = document.body;
			var docElem = document.documentElement;
			var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop;
			var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft;
			var clientTop = docElem.clientTop || body.clientTop || 0;
			var clientLeft = docElem.clientLeft || body.clientLeft || 0;
			var top  = box.top +  scrollTop - clientTop;
			var left = box.left + scrollLeft - clientLeft;
			return { y: Math.round(top), x: Math.round(left), width:elem.offsetWidth, height:elem.offsetHeight };
		} else { //fallback to naive approach
			var top=0, left=0;
			while(elem) {
				top = top + parseInt(elem.offsetTop,10);
				left = left + parseInt(elem.offsetLeft,10);
				elem = elem.offsetParent;
			}
			return { y: top, x: left, width:elem.offsetHeight, height:elem.offsetWidth };
		}
	},
	//returns relative position of event
	posRelative:function(ev){
		ev = ev || event;
		if (!smdui.isUndefined(ev.offsetX))
			return { x:ev.offsetX, y:ev.offsetY };	//ie, webkit
		else
			return { x:ev.layerX, y:ev.layerY };	//firefox
	},
	//returns position of event
	pos:function(ev){
		ev = ev || event;
		if (ev.touches && ev.touches[0])
			ev = ev.touches[0];

		if(ev.pageX || ev.pageY)	//FF, KHTML
			return {x:ev.pageX, y:ev.pageY};
		//IE
		var d  =  ((smdui.env.isIE)&&(document.compatMode != "BackCompat"))?document.documentElement:document.body;
		return {
			x:ev.clientX + d.scrollLeft - d.clientLeft,
			y:ev.clientY + d.scrollTop  - d.clientTop
		};
	},
	//prevent event action
	preventEvent:function(e){
		if(e && e.preventDefault) e.preventDefault();
		if(e) e.returnValue = false;
		return smdui.html.stopEvent(e);
	},
	//stop event bubbling
	stopEvent:function(e){
		e = (e||event);
		if(e.stopPropagation) e.stopPropagation();
		e.cancelBubble=true;
		return false;
	},
	triggerEvent:function(node, type, name){
		if(document.createEventObject){
			var ev = document.createEventObject();
			if (node.fireEvent)
				node.fireEvent("on"+name, ev);
		} else{
			var ev = document.createEvent(type);
			ev.initEvent(name, true, true);
			if (node.dispatchEvent)
				node.dispatchEvent(ev);
		}
	},
	//add css class to the node
	addCss:function(node,name,check){
		if (!check || node.className.indexOf(name) === -1)
			node.className+=" "+name;
	},
	//remove css class from the node
	removeCss:function(node,name){
		node.className=node.className.replace(RegExp(" "+name,"g"),"");
	},
	getTextSize:function(text, css, width){
		var d = smdui.html.create("DIV",{"class":"smdui_view smdui_measure_size "+(css||"")},"");
		d.style.cssText = "height:auto;visibility:hidden; position:absolute; top:0px; left:0px; overflow:hidden;"+(width?("width:"+width+"px;"):"width:auto;white-space:nowrap;");
		document.body.appendChild(d);

		var all = (typeof text !==  "object") ? [text] : text;
		var width = 0;
		var height = 0;

		for (var i = 0; i < all.length; i++) {
			d.innerHTML = all[i];
			width = Math.max(width, d.offsetWidth);
			height = Math.max(height, d.offsetHeight);
		}
		
		smdui.html.remove(d);
		return { width:width, height:height };
	},
	download:function(data, filename){
		var objUrl = false;

		if(typeof data =="object"){//blob
			if(window.navigator.msSaveBlob)
				return window.navigator.msSaveBlob(data, filename);
			else {
				data = window.URL.createObjectURL(data);
				objUrl = true;
			}
		}
		//data url or blob url
		var link = document.createElement("a");
		link.href = data;
		link.download = filename;
		document.body.appendChild(link);
		link.click(); 

		smdui.delay(function(){
			if(objUrl) window.URL.revokeObjectURL(data);
			document.body.removeChild(link);
			link.remove();
		});
	},
	_getClassName: function(node){
		if(!node) return "";

		var className = node.className || "";
		if(className.baseVal)//'className' exist but not a string - IE svg element in DOM
			className = className.baseVal;

		if(!className.indexOf)
			className = "";

		return className;
	},
	setSelectionRange:function(node, start, end){
		start = start || 0;
		end  = end || start;

		node.focus();
		if(node.setSelectionRange)
			node.setSelectionRange(start, end);
		else{
			//ie8
			var textRange = node.createTextRange();
			textRange.collapse(true);
			textRange.moveEnd('character', end);
			textRange.moveStart('character', start);
			textRange.select();
		}
	},
	getSelectionRange:function(node){
		if("selectionStart" in node)
			return {start:node.selectionStart || 0, end:node.selectionEnd || 0};
		else{
			//ie8
			node.focus();
			var selection = document.selection.createRange();
			var bookmark = selection.getBookmark();
			var textRange = node.createTextRange();
 
			textRange.moveToBookmark(bookmark);
			var length = textRange.text.length;
			
			textRange.collapse(true);
			textRange.moveStart('character', -node.value.length);
  
			var start = textRange.text.length;
			return {start:start, end: start + length};
		}
	}
};

smdui.ready = function(code){
	if (this._ready) code.call();
	else this._ready_code.push(code);
};
smdui.debug_ready = smdui.ready; //same command but will work only in dev. build
smdui._ready_code = [];

//autodetect codebase folder
(function(){
	var temp = document.getElementsByTagName("SCRIPT");	//current script, most probably
	smdui.assert(temp.length,"Can't locate codebase");
	if (temp.length){
		//full path to script
		temp = (temp[temp.length-1].getAttribute("src")||"").split("/");
		//get folder name
		temp.splice(temp.length-1, 1);
		smdui.codebase = temp.slice(0, temp.length).join("/")+"/";
	}

	var ready = function(){
		if(smdui.env.isIE)
			document.body.className += " smdui_ie";
		smdui.callEvent("onReady",[]);
	};

	var doit = function(){
		smdui._ready = true;

		//global plugins
		if (window.smdui_ready && smdui.isArray(smdui_ready))
			smdui._ready_code = smdui_ready.concat(smdui._ready_code);

		for (var i=0; i < smdui._ready_code.length; i++)
			smdui._ready_code[i].call();
		smdui._ready_code=[];
	};

	smdui.attachEvent("onReady", function(force){
		if (force) 
			doit();
		else 
			smdui.delay(doit);
	});

	if (document.readyState == "complete") ready();
	else smdui.event(window, "load", ready);
	
})();

smdui.locale=smdui.locale||{};


smdui.assert_core_ready();


smdui.ready(function(){
	smdui.event(document.body,"click", function(e){
		smdui.callEvent("onClick",[e||event]);
	});
});
smdui.editStop = function(){
	smdui.callEvent("onEditEnd", []);
};


smdui.debug_blacklist={
	onmousemoving:1
};

/**

Bazed on Promiz - A fast Promises/A+ library 
https://github.com/Zolmeister/promiz

The MIT License (MIT)

Copyright (c) 2014 Zolmeister

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

/* jshint ignore:start */
(function (self) {
  var now = typeof setImmediate !== 'undefined' ? setImmediate : function(cb) {
    setTimeout(cb, 0)
  }
  
  /**
   * @constructor
   */
  function promise(fn, er) {
    var self = this

    self.promise = self
    self.state = 'pending'
    self.val = null
    self.fn = fn || null
    self.er = er || null
    self.next = [];
  }

  promise.prototype.resolve = function (v) {
    var self = this
    if (self.state === 'pending') {
      self.val = v
      self.state = 'resolving'

      now(function () {
        self.fire()
      })
    }
  }

  promise.prototype.reject = function (v) {
    var self = this
    if (self.state === 'pending') {
      self.val = v
      self.state = 'rejecting'

      now(function () {
        self.fire()
      })
    }
  }

  promise.prototype.then = function (fn, er) {
    var self = this
    var p = new promise(fn, er)
    self.next.push(p)
    if (self.state === 'resolved') {
      p.resolve(self.val)
    }
    if (self.state === 'rejected') {
      p.reject(self.val)
    }
    return p
  }
  promise.prototype.fail = function (er) {
    return this.then(null, er)
  }
  promise.prototype.finish = function (type) {
    var self = this
    self.state = type

    if (self.state === 'resolved') {
      for (var i = 0; i < self.next.length; i++)
        self.next[i].resolve(self.val);
    }

    if (self.state === 'rejected') {
      for (var i = 0; i < self.next.length; i++)
        self.next[i].reject(self.val);

      if (smdui.assert && !self.next.length)
        throw(self.val);
    }
  }

  // ref : reference to 'then' function
  // cb, ec, cn : successCallback, failureCallback, notThennableCallback
  promise.prototype.thennable = function (ref, cb, ec, cn, val) {
    var self = this
    val = val || self.val
    if (typeof val === 'object' && typeof ref === 'function') {
      try {
        // cnt protects against abuse calls from spec checker
        var cnt = 0
        ref.call(val, function(v) {
          if (cnt++ !== 0) return
          cb(v)
        }, function (v) {
          if (cnt++ !== 0) return
          ec(v)
        })
      } catch (e) {
        ec(e)
      }
    } else {
      cn(val)
    }
  }

  promise.prototype.fire = function () {
    var self = this
    // check if it's a thenable
    var ref;
    try {
      ref = self.val && self.val.then
    } catch (e) {
      self.val = e
      self.state = 'rejecting'
      return self.fire()
    }

    self.thennable(ref, function (v) {
      self.val = v
      self.state = 'resolving'
      self.fire()
    }, function (v) {
      self.val = v
      self.state = 'rejecting'
      self.fire()
    }, function (v) {
      self.val = v
      
      if (self.state === 'resolving' && typeof self.fn === 'function') {
        try {
          self.val = self.fn.call(undefined, self.val)
        } catch (e) {
          self.val = e
          return self.finish('rejected')
        }
      }

      if (self.state === 'rejecting' && typeof self.er === 'function') {
        try {
          self.val = self.er.call(undefined, self.val)
          self.state = 'resolving'
        } catch (e) {
          self.val = e
          return self.finish('rejected')
        }
      }

      if (self.val === self) {
        self.val = TypeError()
        return self.finish('rejected')
      }

      self.thennable(ref, function (v) {
        self.val = v
        self.finish('resolved')
      }, function (v) {
        self.val = v
        self.finish('rejected')
      }, function (v) {
        self.val = v
        self.state === 'resolving' ? self.finish('resolved') : self.finish('rejected')
      })

    })
  }

  promise.prototype.done = function () {
    if (this.state = 'rejected' && !this.next) {
      throw this.val
    }
    return null
  }

  promise.prototype.nodeify = function (cb) {
    if (typeof cb === 'function') return this.then(function (val) {
        try {
          cb(null, val)
        } catch (e) {
          setImmediate(function () {
            throw e
          })
        }

        return val
      }, function (val) {
        try {
          cb(val)
        } catch (e) {
          setImmediate(function () {
            throw e
          })
        }

        return val
      })

    return this
  }

  promise.prototype.spread = function (fn, er) {
    return this.all().then(function (list) {
      return typeof fn === 'function' && fn.apply(null, list)
    }, er)
  }
  
  promise.prototype.all = function() {
    var self = this
    return this.then(function(list){
      var p = new promise()
      if(!(list instanceof Array)) {
        p.reject(TypeError)
        return p
      }
      
      var cnt = 0
      var target = list.length
      
      function done() {
        if (++cnt === target) p.resolve(list)
      }
      
      for(var i=0, l=list.length; i<l; i++) {
        var value = list[i]
        var ref;
        
        try {
          ref = value && value.then
        } catch (e) {
          p.reject(e)
          break
        }
        
        (function(i){
          self.thennable(ref, function(val){
            list[i] = val
            done()
          }, function(val){
            p.reject(val);
          }, function(){
            done()
          }, value)
        })(i)
      }

      return p
    })
  }

  // self object gets globalalized/exported
  var promiz = {

    all:function(list){
      var p = new promise(null, null);
      p.resolve(list);
      return p.all();
    },
    // promise factory
    defer: function () {
      return new promise(null, null)
    },

    reject:function(v){
      var t = this.defer();
      t.state = "rejected";
      t.val = v;
      return t;
    },

    resolve:function(v){
      var t = this.defer();
      t.state = "resolved";
      t.val = v;
      return t;
    },

    // calls a function and resolved as a promise
    fcall: function() {
      var def = new promise()
      var args = Array.apply([], arguments)
      var fn = args.shift()
      try {
        var val = fn.apply(null, args)
        def.resolve(val)
      } catch(e) {
        def.reject(e)
      }

      return def
    },

    // calls a node-style function (eg. expects callback as function(err, callback))
    nfcall: function() {
      var def = new promise()
      var args = Array.apply([], arguments)
      var fn = args.shift()
      try {

        // Add our custom promise callback to the end of the arguments
        args.push(function(err, val){
          if(err) {
            return def.reject(err)
          }
          return def.resolve(val)
        })
        fn.apply(null, args)
      } catch (e) {
        def.reject(e)
      }

      return def
    }
  }
  
  self.promise = promiz
})(smdui);
/* jshint ignore:end */

(function(){

var error_key = "__smdui_remote_error";

function RemoteContext(url, config){
	this._proxy = {};
	this._queue = [];
	this._url = url;
	this._key = "";

	if (config)
		this._process(config);
	else
		this._ready = smdui.ajax(url)
			.then(function(data){
				return data.text();
			})
			.then(smdui.bind(function(text){
				text = text.split("/*api*/")[1];
				this._process(JSON.parse(text));
				return this._proxy;
			}, this));
}
RemoteContext.prototype = {
	_process:function(config){
		if (config.$key)
			this._key = config.$key;
		if (config.$vars)
			for (var key in config.$vars)
				this._proxy[key] = config.$vars[key];

		this._parse(config, this._proxy, "");
	},
	_parse:function(api, obj, prefix){
		for (var key in api){
			if (key === "$key" || key === "$vars") continue;
			var val = api[key];
			if (typeof val == "object"){
				var sub = obj[key] = {};
				this._parse(val, sub, prefix+key+".");
			} else
				obj[key] = this._proxy_call(this, prefix+key);
		}
	},
	_call:function(name, args){
		var def = this._deffer(this, name, args);
		this._queue.push(def);
		this._start_queue();
		return def;
	},
	_start_queue:function(){
		if (!this._timer)
			this._timer = setTimeout(smdui.bind(this._run_queue, this), 1);
	},
	_run_queue:function(){
		var data = [], defs = this._queue;
		for (var i=0; i<this._queue.length; i++){
			var def = this._queue[i];
			if (def.$sync){
				defs.splice(i,1); i--;
			} else
				data.push({ name: def.$name, args: def.$args });	
		}

		if (defs.length){
			var ajax = smdui.ajax();
			var pack = this._pack(data);
			smdui.callEvent("onBeforeRemoteCall", [ajax, pack, {}]);
			var promise = ajax.post(this._url, pack)
				.then(function(res){
					var data = res.json();
					var results = data.data;
					for (var i=0; i<results.length; i++){
						var res = results[i];
						var error = results[i] && results[i][error_key];
						if (error){
							smdui.callEvent("onRemoteError", [error]);
							defs[i].reject(error);
						} else {
							defs[i].resolve(res);
						}
					}		
				}, function(res){
					for (var i=0; i<defs.length; i++)
						defs[i].reject(res);
					throw res;
				});
			smdui.callEvent("onAfterRemoteCall", [promise]);
		}

		this._queue = [];
		this._timer = null;
	},
	_sync:function(){
		var value = null;
		this.$sync = true;
		var data = [{ name: this.$name, args: this.$args }];

		try {
			var ajax = smdui.ajax();
			var pack = this.$context._pack(data);
			smdui.callEvent("onBeforeRemoteCall", [ajax, pack, { sync: true }]);
			var xhr = ajax.sync().post(this.$context._url, pack);
			smdui.callEvent("onAfterRemoteCall", [null]);
			var value = JSON.parse(xhr.responseText).data[0];
			if (value[error_key])
				value = null;
		} catch(e){}

		return value;
	},
	_deffer:function(master, name, args){
		var pr = smdui.promise.defer();
		pr.sync = master._sync;
		pr.$name = name;
		pr.$args = args;
		pr.$context = this;

		return pr;
	},
	_proxy_call:function(master, name){
		return function(){
			return master._call(name, [].slice.call(arguments));
		};
	},
	_getProxy:function(){
		return this._ready || this._proxy;
	},
	_pack:function(obj){
		return {
			key: this._key,
			payload:obj
		};
	}
};

function getApi(url, config){
	var ctx = new RemoteContext(url, config);
	return ctx._getProxy();
}

smdui.remote = function(url, config){
	if (typeof url === "object"){
		var scripts = document.getElementsByTagName("script");
		config = url;
		url = scripts[scripts.length - 1].src;
		smdui.remote = getApi(url, config);
	} else 
		return getApi(url, config);
};


})();

/*
	UI:DataView
*/
smdui.skin={};
smdui.skin.air = {
	topLayout:"wide",
	//bar in accordion
	barHeight:34,			//!!!Set the same in skin.less!!!
	tabbarHeight: 36,
	rowHeight:34,
	toolbarHeight:22,
	listItemHeight:28,		//list, grouplist, dataview, etc.
	inputHeight:34,
	inputPadding: 2,
	menuHeight: 34,
	menuMargin:0,
	labelTopHeight: 16,

	inputSpacing: 4,
	borderWidth: 1,

	sliderHandleWidth: 16,
	sliderPadding: 10,
	sliderBorder: 1,

	//margin - distance between cells
	layoutMargin:{ space:10, wide:4, clean:0, head:4, line:-1, toolbar:4, form:8  },
	//padding - distance insede cell between cell border and cell content
	layoutPadding:{ space:10, wide:0, clean:0, head:0, line:0, toolbar:4, form:8  },
	//space between tabs in tabbar
	tabMargin:0,

	popupPadding: 8,

	calendarHeight: 70,
	padding:0,

	optionHeight: 27
};
smdui.skin["aircompact"] = {
	topLayout:"wide",
	//bar in accordion
	barHeight:24,			//!!!Set the same in skin.less!!!
	tabbarHeight: 26,
	rowHeight:26,
	toolbarHeight:22,
	listItemHeight:28,		//list, grouplist, dataview, etc. 
	inputHeight:29,
	inputPadding: 2,
	menuHeight: 25,
	menuMargin:0,
	labelTopHeight: 16,

	inputSpacing: 4,
	borderWidth: 1,

	sliderHandleWidth: 16,
	sliderPadding: 10,
	sliderBorder: 1,

	//margin - distance between cells
	layoutMargin:{ space:10, wide:4, clean:0, head:4, line:-1, toolbar:4, form:8  },
	//padding - distance insede cell between cell border and cell content
	layoutPadding:{ space:10, wide:0, clean:0, head:0, line:0, toolbar:4, form:8  },
	//space between tabs in tabbar
	tabMargin:0,

	popupPadding: 8,

	calendarHeight: 70,
	padding:0,

	optionHeight: 23
};

smdui.skin.web = {
	name:"web",
	topLayout:"space",
	//bar in accordion
	barHeight:28,			//!!!Set the same in skin.less!!!
	tabbarHeight: 30,
	rowHeight:30,
	toolbarHeight:22,
	listItemHeight:28,		//list, grouplist, dataview, etc. 
	inputHeight:28,
	inputPadding: 2,
	menuMargin: 0,
	menuHeight: 27,
	labelTopHeight: 16,
	//accordionMargin: 9,

	inputSpacing: 4,
	borderWidth: 1,

	sliderHandleWidth: 16,
	sliderPadding: 10,
	sliderBorder: 1,

	//margin - distance between cells
	layoutMargin:{ space:10, wide:4, clean:0, head:4, line:-1, toolbar:4, form:8, accordion: 9  },
	//padding - distance insede cell between cell border and cell content
	layoutPadding:{ space:10, wide:0, clean:0, head:0, line:0, toolbar:4, form:8, accordion:0  },
	//space between tabs in tabbar
	tabMargin:3,
	tabTopOffset:3,

	popupPadding: 8,

	calendarHeight: 70,
	padding:0,

	optionHeight: 22
};
smdui.skin.clouds = {
	topLayout:"wide",
	//bar in accordion
	barHeight:36,			//!!!Set the same in skin.less!!!
	tabbarHeight: 46,
	rowHeight:34,
	toolbarHeight:22,
	listItemHeight:32,		//list, grouplist, dataview, etc.
	inputHeight:30,
	inputPadding: 2,
	menuHeight: 34,
	labelTopHeight: 16,

	inputSpacing: 4,
	borderWidth: 1,

	sliderHandleWidth: 16,
	sliderPadding: 10,
	sliderBorder: 1,

	//margin - distance between cells
	layoutMargin:{ space:10, wide:4, clean:0, head:4, line:-1, toolbar:4, form:8  },
	//padding - distance insede cell between cell border and cell content
	layoutPadding:{ space:10, wide:0, clean:0, head:0, line:0, toolbar:4, form:8  },
	//space between tabs in tabbar
	tabMargin:2,
	tabOffset:0,
	tabBottomOffset: 10,

	popupPadding: 8,

	calendarHeight: 70,
	padding:0
};
smdui.skin.terrace = {
	topLayout:"space",
	//bar in accordion
	barHeight:37,			//!!!Set the same in skin.less!!!
	tabbarHeight: 39,
	rowHeight:38,
	toolbarHeight:22,
	listItemHeight:28,		//list, grouplist, dataview, etc.
	inputHeight:30,
	inputPadding: 2,
	menuMargin: 0,
	menuHeight: 32,
	labelTopHeight: 16,

	inputSpacing: 4,
	borderWidth: 1,

	sliderHandleWidth: 16,
	sliderPadding: 10,
	sliderBorder: 1,

	//margin - distance between cells
	layoutMargin:{ space:20, wide:20, clean:0, head:4, line:-1, toolbar:4, form:8},
	//padding - distance insede cell between cell border and cell content
	layoutPadding:{ space:20, wide:0, clean:0, head:0, line:0, toolbar:4, form:8 },
	tabMargin:2,
	tabOffset:0,

	popupPadding: 8,

	calendarHeight: 70,
	//space between tabs in tabbar
	padding:17,

	optionHeight: 24
};
smdui.skin.metro = {
	topLayout:"space",
	//bar in accordion
	barHeight:36,			//!!!Set the same in skin.less!!!
	tabbarHeight: 46,
	rowHeight:34,
	toolbarHeight:36,
	listItemHeight:32,		//list, grouplist, dataview, etc.
	inputHeight:30,
	buttonHeight: 45,
	inputPadding: 2,
	menuHeight: 36,
	labelTopHeight: 16,

	inputSpacing: 4,
	borderWidth: 1,

	sliderHandleWidth: 16,
	sliderPadding: 10,
	sliderBorder: 1,

	//margin - distance between cells
	layoutMargin:{ space:10, wide:4, clean:0, head:4, line:-1, toolbar:4, form:8, accordion: 9  },
	//padding - distance insede cell between cell border and cell content
	layoutPadding:{ space:10, wide:0, clean:0, head:0, line:0, toolbar:0, form:8, accordion: 0  },
	//space between tabs in tabbar
	tabMargin:2,
	tabOffset:0,
	tabBottomOffset: 10,

	popupPadding: 8,

	calendarHeight: 70,
	padding:0,

	optionHeight: 23
};
smdui.skin.light = {
	topLayout:"space",
	//bar in accordion
	barHeight:36,			//!!!Set the same in skin.less!!!
	tabbarHeight: 46,
	rowHeight:32,
	toolbarHeight:36,
	listItemHeight:32,		//list, grouplist, dataview, etc.
	inputHeight:34,
	buttonHeight: 45,
	inputPadding: 3,
	menuHeight: 36,
	labelTopHeight: 16,

	inputSpacing: 4,
	borderWidth: 1,

	sliderHandleWidth: 16,
	sliderPadding: 10,
	sliderBorder: 1,

	//margin - distance between cells
	layoutMargin:{ space:15, wide:15, clean:0, head:4, line:-1, toolbar:4, form:8, accordion: 10  },
	//padding - distance insede cell between cell border and cell content
	layoutPadding:{ space:15, wide:0, clean:0, head:0, line:0, toolbar:0, form:8, accordion: 0  },
	//space between tabs in tabbar
	tabMargin:2,
	tabOffset:0,
	tabBottomOffset: 10,

	popupPadding: 8,


	calendarHeight: 70,
	padding:0,

	optionHeight: 27
};
smdui.skin.glamour = {
	topLayout:"space",
	//bar in accordion
	barHeight:39,			//!!!Set the same in skin.less!!!
	tabbarHeight: 39,
	rowHeight:32,
	toolbarHeight:39,
	listItemHeight:32,		//list, grouplist, dataview, etc.
	inputHeight:34,
	buttonHeight: 34,
	inputPadding: 3,
	menuHeight: 36,
	labelTopHeight: 16,

	inputSpacing: 4,
	borderWidth: 1,

	sliderHandleWidth: 16,
	sliderPadding: 10,
	sliderBorder: 1,

	//margin - distance between cells
	layoutMargin:{ space:15, wide:15, clean:0, head:4, line:-1, toolbar:4, form:8, accordion: 10  },
	//padding - distance insede cell between cell border and cell content
	layoutPadding:{ space:15, wide:0, clean:0, head:0, line:0, toolbar:3, form:8, accordion: 0  },
	//space between tabs in tabbar
	tabMargin:1,
	tabOffset:0,
	tabBottomOffset: 1,

	popupPadding: 8,

	calendarHeight: 70,
	padding:0,

	optionHeight: 27
};
smdui.skin.touch = {
	topLayout:"space",
	//bar in accordion
	barHeight:42,			//!!!Set the same in skin.less!!!
	tabbarHeight: 50,
	rowHeight:42,
	toolbarHeight: 42,
	listItemHeight:42,		//list, grouplist, dataview, etc.
	inputHeight:42,
	inputPadding: 4,
	menuHeight: 42,
	labelTopHeight: 24,
	unitHeaderHeight: 34,

	inputSpacing: 4,
	borderWidth: 1,

	sliderHandleWidth: 16,
	sliderPadding: 10,
	sliderBorder: 1,

	//margin - distance between cells
	layoutMargin:{ space:10, wide:4, clean:0, head:4, line:-1, toolbar:0, form:0, accordion: 9  },
	//padding - distance insede cell between cell border and cell content
	layoutPadding:{ space:10, wide:0, clean:0, head:0, line:0, toolbar:4, form:8, accordion: 0  },
	//space between tabs in tabbar
	tabMargin:2,
	tabOffset:0,
	tabBottomOffset: 10,
	calendar:{headerHeight: 70, timepickerHeight:35, height: 310, width: 300},
	padding:0,
	customCheckbox: true,
	customRadio: true,

	popupPadding: 8,

	optionHeight: 32
};
smdui.skin.flat = {
	topLayout:"space",
	//bar in accordion
	barHeight:46,			//!!!Set the same in skin.less!!!
	tabbarHeight: 46,
	rowHeight:34,
	toolbarHeight:46,
	listItemHeight:34,		//list, grouplist, dataview, etc.
	inputHeight: 38,
	buttonHeight: 38,
	inputPadding: 3,
	menuHeight: 34,
	labelTopHeight: 22,
	propertyItemHeight: 28,

	inputSpacing: 4,
	borderWidth: 1,

	sliderHandleWidth: 16,
	sliderPadding: 10,
	sliderBorder: 1,

	//margin - distance between cells
	layoutMargin:{ space:10, wide:10, clean:0, head:4, line:-1, toolbar:4, form:8, accordion: 10  },
	//padding - distance insede cell between cell border and cell content
	layoutPadding:{ space:10, wide:0, clean:0, head:0, line:0, toolbar:4, form:17, accordion: 0  },
	//space between tabs in tabbar
	tabMargin:4,
	tabOffset: 0,
	tabBottomOffset: 6,
	tabTopOffset:1,

	customCheckbox: true,
	customRadio: true,

	popupPadding: 8,

	calendarHeight: 70,
	padding:0,
	accordionType: "accordion",

	optionHeight: 32
};
smdui.skin.compact = {
	topLayout:"space",
	//bar in accordion
	barHeight:34,			//!!!Set the same in skin.less!!!
	tabbarHeight: 34,
	rowHeight:24,
	toolbarHeight:34,
	listItemHeight:28,		//list, grouplist, dataview, etc.
	inputHeight: 30,
	buttonHeight: 30,
	inputPadding: 3,
	menuHeight: 28,
	labelTopHeight: 16,

	inputSpacing: 4,
	borderWidth: 1,

	sliderHandleWidth: 16,
	sliderPadding: 10,
	sliderBorder: 1,

	//margin - distance between cells
	layoutMargin:{ space:5, wide:5, clean:0, head:4, line:-1, toolbar:4, form:4, accordion: 5  },
	//padding - distance insede cell between cell border and cell content
	layoutPadding:{ space:5, wide:0, clean:0, head:0, line:0, toolbar:2, form:12, accordion: 0  },
	//space between tabs in tabbar
	tabMargin:3,
	tabOffset: 0,
	tabBottomOffset: 3,
	tabTopOffset:1,

	customCheckbox: true,
	customRadio: true,

	popupPadding: 8,

	calendarHeight: 70,
	padding:0,
	accordionType: "accordion",

	optionHeight: 23
};
smdui.skin.material = {
	topLayout:"space",
	//bar in accordion
	barHeight:45,			//!!!Set the same in skin.less!!!
	tabbarHeight:47,
	rowHeight:38,
	toolbarHeight:22,
	listItemHeight:34,		//list, grouplist, dataview, etc.
	inputHeight:38,
	buttonHeight:38,
	inputPadding: 2,
	menuMargin: 0,
	menuHeight: 34,
	labelTopHeight: 16,
	propertyItemHeight: 34,

	inputSpacing: 4,
	borderWidth: 1,

	sliderHandleWidth: 16,
	sliderPadding: 10,
	sliderBorder: 1,

	//margin - distance between cells
	layoutMargin:{ material:10, space:10, wide:10, clean:0, head:4, line:-1, toolbar:4, form:16, accordion: 0  },
	//padding - distance insede cell between cell border and cell content
	layoutPadding:{ material:10, space:10, wide:0, clean:0, head:0, line:0, toolbar:4, form:16, accordion: 0  },
	//space between tabs in tabbar
	tabMargin:0,
	tabOffset: 0,
	tabBottomOffset: 0,
	tabTopOffset:0,

	customCheckbox: true,
	customRadio: true,

	popupPadding: 8,

	calendarHeight: 70,
	padding:0,
	accordionType: "accordion"
};
smdui.skin.contrast = {
	topLayout:"space",
	//bar in accordion
	barHeight:46,			// !!!Set the same in skin.less!!!
	tabbarHeight: 46,
	rowHeight:34,
	toolbarHeight:46,
	listItemHeight:34,		// list, grouplist, dataview, etc.
	inputHeight: 38,
	buttonHeight: 38,
	inputPadding: 3,
	menuHeight: 34,
	labelTopHeight: 22,
	propertyItemHeight: 28,

	inputSpacing: 4,
	borderWidth: 1,

	sliderHandleWidth: 16,
	sliderPadding: 10,
	sliderBorder: 1,

	//margin - distance between cells
	layoutMargin:{ space:10, wide:10, clean:0, head:4, line:-1, toolbar:8, form:8, accordion: 10  },
	//padding - distance insede cell between cell border and cell content
	layoutPadding:{ space:10, wide:0, clean:0, head:0, line:0, toolbar:4, form:17, accordion: 0  },
	//space between tabs in tabbar
	tabMargin:4,
	tabOffset: 0,
	tabBottomOffset: 6,
	tabTopOffset:1,

	customCheckbox: true,
	customRadio: true,

	popupPadding: 8,

	calendarHeight: 70,
	padding:0,
	accordionType: "accordion",

	optionHeight: 32
};
smdui.skin.smdterrace = {
    topLayout: "space",
    //bar in accordion
    barHeight: 36,			//!!!Set the same in skin.less!!!
    tabbarHeight: 46,
    rowHeight: 36,
    toolbarHeight: 36,
    listItemHeight: 32,		//list, grouplist, dataview, etc.
    inputHeight: 40,
    buttonHeight: 45,
    inputPadding: 3,
    menuHeight: 36,
    labelTopHeight: 16,
    inputSpacing: 4,
    borderWidth: 1,
    sliderHandleWidth: 16,
    sliderPadding: 10,
    sliderBorder: 1,

    //margin - distance between cells
    layoutMargin: { space: 15, wide: 15, clean: 0, head: 4, line: -1, toolbar: 4, form: 8, accordion: 10 },
    //padding - distance insede cell between cell border and cell content
    layoutPadding: { space: 15, wide: 0, clean: 0, head: 0, line: 0, toolbar: 0, form: 8, accordion: 0 },
    //space between tabs in tabbar
    tabMargin: 2,
    tabOffset: 0,
    tabBottomOffset: 10,

    popupPadding: 8,


    calendarHeight: 70,
    padding: 0,

    optionHeight: 27
};
smdui.skin.set = function(name){
	smdui.assert(smdui.skin[name], "Incorrect skin name: "+name);

	smdui.skin.$active = smdui.skin[name];
	smdui.skin.$name = name;
	if (smdui.ui){
		for (var key in smdui.ui){
			var view = smdui.ui[key];
			if (view && view.prototype && view.prototype.$skin)
				view.prototype.$skin(view.prototype);
		}
	}		
};
smdui.skin.set(window.smdui_skin || "smdterrace");

/*
	Behavior:Destruction
	
	@export
		destructor
*/
smdui.Destruction = {
	$init:function(){
		//wrap in object to simplify removing self-reference
		var t  = this._destructor_handler = { obj: this};

		//register self in global list of destructors
		smdui.destructors.push(t);
	},
	//will be called automatically on unload, can be called manually
	//simplifies job of GC
	destructor:function(){
		var config = this._settings;

		if (this._last_editor)
			this.editCancel();

		if(this.callEvent)
			this.callEvent("onDestruct",[]);

		//destructor can be called only once
		this.destructor=function(){};
		//remove self reference from global destructions collection
		this._destructor_handler.obj = null;

		//destroy child and related cells
		if (this.getChildViews){
			var cells = this.getChildViews();
			if (cells)
				for (var i=0; i < cells.length; i++)
					cells[i].destructor();

			if (this._destroy_with_me)
				for (var i=0; i < this._destroy_with_me.length; i++)
					this._destroy_with_me[i].destructor();
		}

		delete smdui.ui.views[config.id];

		if (config.$id){
			var top = this.getTopParentView();
			if (top && top._destroy_child)
				top._destroy_child(config.$id);
		}

		//html collection
		this._htmlmap  = null;
		this._htmlrows = null;
		this._html = null;


		if (this._contentobj) {
			this._contentobj.innerHTML="";
			this._contentobj._htmlmap = null;
		}

		//removes view container
		if (this._viewobj&&this._viewobj.parentNode){
			this._viewobj.parentNode.removeChild(this._viewobj);
		}

		if (this.data && this.data.destructor)
			this.data.destructor();

		if (this.unbind)
			this.unbind();

		this.data = null;
		this._viewobj = this.$view = this._contentobj = this._dataobj = null;
		this._evs_events = this._evs_handlers = {};

		//remove focus from destructed view
		if (smdui.UIManager._view == this)
			smdui.UIManager._view = null;

		var url = config.url;
		if (url && url.$proxy && url.release)
			url.release();

		this.$scope = null;
		// this flag is checked in delay method
		this.$destructed = true;
	}
};
//global list of destructors
smdui.destructors = [];
smdui.event(window,"unload",function(){
	smdui.callEvent("unload", []);
	smdui._final_destruction = true;
	
	//call all registered destructors
	for (var i=0; i<smdui.destructors.length; i++){
		var obj = smdui.destructors[i].obj;
		if (obj)
			obj.destructor();
	}
	smdui.destructors = [];
	smdui.ui._popups = smdui.toArray();

	//detach all known DOM events
	for (var a in smdui._events)
		smdui.eventRemove(a);
});

/*
	Behavior:Settings
	
	@export
		customize
		config
*/

/*
	Template - handles html templates
*/
(function(){

var _cache = {};
var _csp_cache = {};
var newlines = new RegExp("(\\r\\n|\\n)","g");
var quotes   = new RegExp("(\\\")","g");
var slashes  = new RegExp("(\\\\)","g");
var escape = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;"
};
var badChars = /[&<>"'`]/g;
var escapeChar = function(chr) {
  return escape[chr] || "&amp;";
};


smdui.template = function(str){
	if (typeof str == "function") return str;
	if (_cache[str])
		return _cache[str];
		
	str=(str||"").toString();			
	if (str.indexOf("->")!=-1){
		var teststr = str.split("->");
		switch(teststr[0]){
			case "html": 	//load from some container on the page
				str = smdui.html.getValue(teststr[1]);
				break;
			case "http": 	//load from external file
				str = new smdui.ajax().sync().get(teststr[1],{uid:smdui.uid()}).responseText;
				break;
			default:
				//do nothing, will use template as is
				break;
		}
	}
		
	//supported idioms
	// {obj.attr} => named attribute or value of sub-tag in case of xml
	str=(str||"").toString();		

	// Content Security Policy enabled
	if(smdui.env.strict){
		if (!_csp_cache[str]){
			_csp_cache[str] = [];

			// get an array of objects (not sorted by position)
			var temp_res = [];
			str.replace(/\{obj\.([^}?]+)\?([^:]*):([^}]*)\}/g,function(search,s1,s2,s3,pos){
					temp_res.push({pos: pos, str: search, fn: function(obj,common){
						return obj[s1]?s2:s3;
					}});
			});
			str.replace(/\{common\.([^}\(]*)\}/g,function(search,s,pos){
				temp_res.push({pos: pos, str: search, fn: function(obj,common){
					return common[s]||'';
				}});
			});
			str.replace(/\{common\.([^\}\(]*)\(\)\}/g,function(search,s,pos){
				temp_res.push({pos: pos, str: search, fn: function(obj,common){
					return (common[s]?common[s].apply(this, arguments):"");
				}});
			});
			str.replace(/\{obj\.([^:}]*)\}/g,function(search,s,pos){
				temp_res.push({pos: pos, str: search, fn: function(obj,common){
					return obj[s];
				}});
			});
			str.replace("{obj}",function(search,s,pos){
				temp_res.push({pos: pos, str: search, fn: function(obj,common){
					return obj;
				}});
			});
			str.replace(/#([^#'";, ]+)#/gi,function(search,s,pos){
				if(s.charAt(0)=="!"){
					s = s.substr(1);
					temp_res.push({pos: pos, str: search, fn: function(obj,common){
						if(s.indexOf(".")!= -1)
							obj = smdui.CodeParser.collapseNames(obj); // apply complex properties
						return smdui.template.escape(obj[s]);
					}});
				}
				else{
					temp_res.push({pos: pos, str: search, fn: function(obj,common){
						if(s.indexOf(".")!= -1)
							obj = smdui.CodeParser.collapseNames(obj); // apply complex properties
						return obj[s];
					}});
				}

			});

			// sort template parts by position
			temp_res.sort(function(a,b){
				return (a.pos > b.pos)?1:-1;
			});

			// create an array of functions that return parts of html string
			if(temp_res.length){
				var lastPos = 0;
				var addStr = function(str,n0,n1){
					_csp_cache[str].push(function(){
						return str.slice(n0,n1);
					});
				};
				for(var i = 0; i< temp_res.length; i++){
					var pos = temp_res[i].pos;
					addStr(str,lastPos,pos);
					_csp_cache[str].push(temp_res[i].fn);
					lastPos = pos + temp_res[i].str.length;
				}
				addStr(str,lastPos,str.length);
			}
			else
				_csp_cache[str].push(function(){return str;});
		}
		return function(){
			var s = "";
			for(var i=0; i < _csp_cache[str].length;i++){
				s += _csp_cache[str][i].apply(this,arguments);
			}
			return s;
		};
	}

	str=str.replace(slashes,"\\\\");
	str=str.replace(newlines,"\\n");
	str=str.replace(quotes,"\\\"");

	str=str.replace(/\{obj\.([^}?]+)\?([^:]*):([^}]*)\}/g,"\"+(obj.$1?\"$2\":\"$3\")+\"");
	str=str.replace(/\{common\.([^}\(]*)\}/g,"\"+(common.$1||'')+\"");
	str=str.replace(/\{common\.([^\}\(]*)\(\)\}/g,"\"+(common.$1?common.$1.apply(this, arguments):\"\")+\"");
	str=str.replace(/\{obj\.([^}]*)\}/g,"\"+(obj.$1)+\"");
	str=str.replace("{obj}","\"+obj+\"");
	str=str.replace(/#([^#'";, ]+)#/gi,function(str, key){
		if (key.charAt(0)=="!")
			return "\"+smdui.template.escape(obj."+key.substr(1)+")+\"";
		else
			return "\"+(obj."+key+")+\"";
	});

	try {
		_cache[str] = Function("obj","common","return \""+str+"\";");
	} catch(e){
		smdui.assert_error("Invalid template:"+str);
	}

	return _cache[str];
};



smdui.template.escape  = function(str){
	if (str === smdui.undefined || str === null) return "";
	return (str.toString() || "" ).replace(badChars, escapeChar);
};
smdui.template.empty=function(){	return "";	};
smdui.template.bind =function(value){	return smdui.bind(smdui.template(value),this); };


	/*
		adds new template-type
		obj - object to which template will be added
		data - properties of template
	*/
smdui.type=function(obj, data){ 
	if (obj.$protoWait){
		if (!obj._smdui_type_wait)
			obj._smdui_type_wait = [];
				obj._smdui_type_wait.push(data);
		return;
	}
		
	//auto switch to prototype, if name of class was provided
	if (typeof obj == "function")
		obj = obj.prototype;
	if (!obj.types){
		obj.types = { "default" : obj.type };
		obj.type.name = "default";
	}
	
	var name = data.name;
	var type = obj.type;
	if (name)
		type = obj.types[name] = smdui.clone(data.baseType?obj.types[data.baseType]:obj.type);
	
	for(var key in data){
		if (key.indexOf("template")===0)
			type[key] = smdui.template(data[key]);
		else
			type[key]=data[key];
	}

	return name;
};

})();


smdui.Settings={
	$init:function(){
		/* 
			property can be accessed as this.config.some
			in same time for inner call it have sense to use _settings
			because it will be minified in final version
		*/
		this._settings = this.config= {}; 
	},
	define:function(property, value){
		if (typeof property == "object")
			return this._parseSeetingColl(property);
		return this._define(property, value);
	},
	_define:function(property,value){
		//method with name {prop}_setter will be used as property setter
		//setter is optional
		var setter = this[property+"_setter"];
		return (this._settings[property]=setter?setter.call(this,value,property):value);
	},
	//process configuration object
	_parseSeetingColl:function(coll){
		if (coll){
			for (var a in coll)				//for each setting
				this._define(a,coll[a]);		//set value through config
		}
	},
	//helper for object initialization
	_parseSettings:function(obj,initial){
		//initial - set of default values
		var settings = {}; 
		if (initial)
			settings = smdui.extend(settings,initial);
					
		//code below will copy all properties over default one
		if (typeof obj == "object" && !obj.tagName)
			smdui.extend(settings,obj, true);	
		//call config for each setting
		this._parseSeetingColl(settings);
	},
	_mergeSettings:function(config, defaults){
		for (var key in defaults)
			switch(typeof config[key]){
				case "object": 
					config[key] = this._mergeSettings((config[key]||{}), defaults[key]);
					break;
				case "undefined":
					config[key] = defaults[key];
					break;
				default:	//do nothing
					break;
			}
		return config;
	}
};
/* 
	ajax operations 
	
	can be used for direct loading as
		smdui.ajax(ulr, callback)
	or
		smdui.ajax().getItem(url)
		smdui.ajax().post(url)

*/
smdui.proxy = function(name, source, extra){
	smdui.assert(smdui.proxy[name], "Invalid proxy name: "+name);

	var copy = smdui.copy(smdui.proxy[name]);
	copy.source = source;

	if (extra)
		smdui.extend(copy, extra, true);

	if (copy.init) copy.init();
	return copy;
};

smdui.proxy.$parse = function(value){
	if (typeof value == "string" && value.indexOf("->") != -1){
		var parts = value.split("->");
		return smdui.proxy(parts[0], parts[1]);
	}
	return value;
};

smdui.proxy.post = {
	$proxy:true,
	load:function(view, callback, params){
		params = smdui.extend(params||{}, this.params || {}, true);
		smdui.ajax().bind(view).post(this.source, params, callback);
	}
};

smdui.proxy.sync = {
	$proxy:true,
	load:function(view, callback){
		smdui.ajax().sync().bind(view).get(this.source, null, callback);
	}
};

smdui.proxy.connector = {
	$proxy:true,

	connectorName:"!nativeeditor_status",
	load:function(view, callback){
		smdui.ajax(this.source, callback, view);
	},
	saveAll:function(view, updates, dp, callback){
		var url = this.source;

		var data = {};
		var ids = [];
		for (var i = 0; i < updates.length; i++) {
			var action = updates[i];
			ids.push(action.id);

			for (var j in action.data)
				if (j.indexOf("$")!==0)
					data[action.id+"_"+j] = action.data[j];
			data[action.id+"_"+this.connectorName] = action.operation;
		}

		data.ids = ids.join(",");
		data.smdui_security = smdui.securityKey;
	
		url += (url.indexOf("?") == -1) ? "?" : "&";
		url += "editing=true";

		smdui.ajax().post(url, data, callback);
	},
	result:function(state, view, dp, text, data, loader){
		data = data.xml();
		if (!data)
			return dp._processError(null, text, data, loader);
		

		var actions = data.data.action;
		if (!actions.length)
			actions = [actions];


		var hash = [];

		for (var i = 0; i < actions.length; i++) {
			var obj = actions[i];
			hash.push(obj);

			obj.status = obj.type;
			obj.id = obj.sid;
			obj.newid = obj.tid;

			dp.processResult(obj, obj, {text:text, data:data, loader:loader});
		}

		return hash;
	}
};

smdui.proxy.debug = {
	$proxy:true,
	load:function(){},
	save:function(v,u,d,c){
		smdui.delay(function(){
			window.console.log("[DP] "+u.id+" -> "+u.operation, u.data);
			var data = {
				id:u.data.id,
				newid:u.data.id,
				status:u.data.operation
			};
			d.processResult(data, data);
		});
	}
};

smdui.proxy.rest = {
	$proxy:true,
	load:function(view, callback){
		smdui.ajax(this.source, callback, view);
	},
	save:function(view, update, dp, callback){
		return smdui.proxy.rest._save_logic.call(this, view, update, dp, callback, smdui.ajax());
	},
	_save_logic:function(view, update, dp, callback, ajax){
		var url = this.source;
		var query = "";
		var mark = url.indexOf("?");

		if (mark !== -1){
			query = url.substr(mark);
			url = url.substr(0, mark);
		}

		url += url.charAt(url.length-1) == "/" ? "" : "/";
		var mode = update.operation;


		var data = update.data;
		if (mode == "insert") delete data.id;

		//call rest URI
		if (mode == "update"){
			ajax.put(url + data.id + query, data, callback);
		} else if (mode == "delete") {
			ajax.del(url + data.id + query, data, callback);
		} else {
			ajax.post(url + query, data, callback);
		}
	}
};

smdui.proxy.json = {
	$proxy:true,
	load:function(view, callback){
		smdui.ajax(this.source, callback, view);
	},
	save:function(view, update, dp, callback){
		var ajax = smdui.ajax().headers({ "Content-Type":"application/json" });
		return smdui.proxy.rest._save_logic.call(this, view, update, dp, callback, ajax);
	}
};

smdui.proxy.faye = {
	$proxy:true,
	init:function(){
		this.clientId = this.clientId || smdui.uid();
	},
	load:function(view){
		var selfid = this.clientId;

		this.client.subscribe(this.source, function(update){
			if (update.clientId == selfid) return;

			smdui.dp(view).ignore(function(){
				if (update.operation == "delete")
					view.remove(update.data.id);
				else if (update.operation == "insert")
					view.add(update.data);
				else if (update.operation == "update"){
					var item = view.getItem(update.data.id);
					if (item){
						smdui.extend(item, update.data, true);
						view.refresh(item.id);
					}
				}
			});
		});
	},
	save:function(view, update, dp, callback){
		update.clientId = this.clientId;
		this.client.publish(this.source, update);
	}
};

//indexdb->database/collection
smdui.proxy.indexdb = {
	$proxy:true,
	create:function(db, config, version, callback){
		this.source = db + "/";
		this._get_db(callback, version, function(e){
			var db = e.target.result;
			for (var key in config){
				var data = config[key];
				var store = db.createObjectStore(key, { keyPath: "id", autoIncrement:true });
				for (var i = 0; i < data.length; i++)
					store.put(data[i]);
			}
		});
	},
	_get_db:function(callback, version, upgrade){
		if (this.source.indexOf("/") != -1){
			var parts = this.source.split("/");
			this.source = parts[1];
			version = version || parts[2];

			var _index = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB;

			var db;
			if (version)
				db = _index.open(parts[0], version);
			else
				db = _index.open(parts[0]);

			if (upgrade)
				db.onupgradeneeded = upgrade;
			db.onerror = function(){ };
			db.onblocked = function(){ };
			db.onsuccess = smdui.bind(function(e){
				this.db =  e.target.result;
				if (callback)
					callback.call(this);
			},this);
		} else if (this.db)
			callback.call(this);
		else 
			smdui.delay(this._get_db, this, [callback], 50);
	},

	load:function(view, callback){
		this._get_db(function(){
			var store = this.db.transaction(this.source).objectStore(this.source);
			var data = [];

			store.openCursor().onsuccess = function(e) {
				var result = e.target.result;
				if(result){
					data.push(result.value);
					result["continue"]();
				} else {
					view.parse(data);
					smdui.ajax.$callback(view, callback, "[]", data);
				}
			};
		});
	},
	save:function(view, update, dp, callback){
		this._get_db(function(){
			var mode = update.operation;
			var data = update.data;
			var id = update.id;

			var store = this.db.transaction([this.source], "readwrite").objectStore(this.source);

			var req;
			if (mode == "delete")
	            req = store["delete"](id);
	       	else if (mode == "update")
	       		req = store.put(data);
	       	else if (mode == "insert"){
	       		delete data.id;
	       		req = store.add(data);
	       	}

			req.onsuccess = function(e) {
				var result = { status: mode, id:update.id };
				if (mode == "insert")
					result.newid = e.target.result;
				dp.processResult(result, result);
			};
		});
	}
};

smdui.proxy.binary = {
	$proxy:true,
	load:function(view, callback){
		var parts = this.source.split("@");
		var ext = parts[0].split(".").pop();
		return smdui.ajax().response("arraybuffer").get(parts[0]).then(function(res){
			var options = { ext:ext, dataurl : parts[1] };
			smdui.ajax.$callback(view, callback, "", { data:res, options:options }, -1);
		});
	}
};

smdui.ajax = function(url,params,call){
	//if parameters was provided - made fast call
	if (arguments.length!==0)
		return (new smdui.ajax()).get(url,params,call);

	if (!this.getXHR) return new smdui.ajax(); //allow to create new instance without direct new declaration

	return this;
};
smdui.ajax.count = 0;
smdui.ajax.prototype={
	master:null,
	//creates xmlHTTP object
	getXHR:function(){
		return new XMLHttpRequest();
	},
	stringify:function(obj){
		return smdui.stringify(obj);
	},
	/*
		send data to the server
		params - hash of properties which will be added to the url
		call - callback, can be an array of functions
	*/
	_send:function(url, params, call, mode){
		var master;
		if (params && (smdui.isArray(params) || (typeof (params.success || params.error || params) == "function"))){
			master = call;
			call = params;
			params = null;
		}

		var defer = smdui.promise.defer();

		var x=this.getXHR();
		if (!smdui.isArray(call))
			call = [call];

		call.push({ success: function(t, d){ defer.resolve(d);	},
					error: function(t, d){ defer.reject(x);	}});

		var headers = this._header || {};

		if (!smdui.callEvent("onBeforeAjax", [mode, url, params, x, headers, null, defer])) return;

		//add content-type to POST|PUT|DELETE
		var json_mode = false;
		if (mode !== 'GET'){
			var found = false;
			for (var key in headers)
				if (key.toString().toLowerCase() == "content-type"){
					found = true;
					if (headers[key] == "application/json")
						json_mode = true;
				}
			if (!found)
				headers['Content-Type'] = 'application/x-www-form-urlencoded';
		}

		//add extra params to the url
		if (typeof params == "object" && !(window.FormData && (params instanceof window.FormData))){
			if (json_mode)
				params = this.stringify(params);
			else {
				var t=[];
				for (var a in params){
					var value = params[a];
					if (value === null || value === smdui.undefined)
						value = "";
				    if(typeof value==="object")
				        value = this.stringify(value);
					t.push(a+"="+encodeURIComponent(value));// utf-8 escaping
			 	}
				params=t.join("&");
			}
		}

		if (params && mode==='GET'){
			url=url+(url.indexOf("?")!=-1 ? "&" : "?")+params;
			params = null;
		}

		x.open(mode, url, !this._sync);

		var type = this._response;
		if (type) x.responseType = type;

		//if header was provided - use it
		for (var key in headers)
			x.setRequestHeader(key, headers[key]);
		
		//async mode, define loading callback
		var self=this;
		this.master = this.master || master;
		x.onreadystatechange = function(){
			if (!x.readyState || x.readyState == 4){
				if (smdui.debug_time) smdui.log_full_time("data_loading");	//log rendering time

				smdui.ajax.count++;
				if (call && self && !x.aborted){
					//IE8 and IE9, handling .abort call
					if (smdui._xhr_aborted.find(x) != -1)
						return smdui._xhr_aborted.remove(x);

					var owner = self.master||self;

					var is_error = x.status >= 400 || x.status === 0;
					var text, data;
					if (x.responseType == "blob" || x.responseType == "arraybuffer"){
						text = "";
						data = x.response;
					} else {
						text = x.responseText||"";
						data = self._data(x);
					}

					smdui.ajax.$callback(owner, call, text, data, x, is_error);
				}
				if (self) self.master=null;
				call=self=master=null;	//anti-leak
			}
		};

		if (this._timeout)
			x.timeout = this._timeout;

		//IE can use sync mode sometimes, fix it
		if (!this._sync)
			setTimeout(function(){
				if (!x.aborted){
					//abort handling in IE9
					if (smdui._xhr_aborted.find(x) != -1)
						smdui._xhr_aborted.remove(x);
					else
						x.send(params||null);
				}
			}, 1);
		else
			x.send(params||null);

		if (this.master && this.master._ajax_queue)
			this.master._ajax_queue.push(x);

		return this._sync?x:defer; //return XHR, which can be used in case of sync. mode
	},
	_data:function(x){
		return {
			xml:function(){ 
				try{
					return smdui.DataDriver.xml.tagToObject(smdui.DataDriver.xml.toObject(x.responseText, this));
				}
				catch(e){
					smdui.log(x.responseText);
					smdui.log(e.toString()); smdui.assert_error("Invalid xml data for parsing"); 
				}
			},
			rawxml:function(){ 
				if (!window.XPathResult)
					return smdui.DataDriver.xml.fromString(x.responseText);
				return x.responseXML;
			},
			text:function(){ return x.responseText; },
			json:function(){
				return smdui.DataDriver.json.toObject(x.responseText, false);
			}
		};
	},
	//GET request
	get:function(url,params,call){
		return this._send(url,params,call,"GET");
	},
	//POST request
	post:function(url,params,call){
		return this._send(url,params,call,"POST");
	},
	//PUT request
	put:function(url,params,call){
		return this._send(url,params,call,"PUT");
	},
	//DELETE request
	del:function(url,params,call){
		return this._send(url,params,call,"DELETE");
	},
	//PATCH request
	patch:function(url,params,call){
		return this._send(url,params,call,"PATCH");
	},

	sync:function(){
		this._sync = true;
		return this;
	},
	timeout:function(num){
		this._timeout = num;
		return this;
	},
	response:function(value){
		this._response = value;
		return this;
	},
	//deprecated, remove in 3.0
	//[DEPRECATED]
	header:function(header){
		smdui.assert(false, "ajax.header is deprecated in favor of ajax.headers");
		this._header = header;
		return this;
	},
	headers:function(header){
		this._header = smdui.extend(this._header||{},header);
		return this;
	},
	bind:function(master){
		this.master = master;
		return this;
	}
};
smdui.ajax.$callback = function(owner, call, text, data, x, is_error){
	if (owner.$destructed) return;
	if (x === -1 && data && typeof data.json == "function")
		data = data.json();

	if (is_error)
		smdui.callEvent("onAjaxError", [x]);

	if (!smdui.isArray(call))
		call = [call];

	if (!is_error)
		for (var i=0; i < call.length; i++){
			if (call[i]){
				var before = call[i].before;
				if (before)
					before.call(owner, text, data, x);
			}
		}

	for (var i=0; i < call.length; i++)	//there can be multiple callbacks
		if (call[i]){
			var method = (call[i].success||call[i]);
			if (is_error)
				method = call[i].error;
			if (method && method.call)
				method.call(owner,text,data,x);
		}
};

/*submits values*/
smdui.send = function(url, values, method, target){
	var form = smdui.html.create("FORM",{
		"target":(target||"_self"),
		"action":url,
		"method":(method||"POST")
	},"");
	for (var k in values) {
		var field = smdui.html.create("INPUT",{"type":"hidden","name": k,"value": values[k]},"");
		form.appendChild(field);
	}
	form.style.display = "none";
	document.body.appendChild(form);
	form.submit();
	document.body.removeChild(form);
};

smdui.AtomDataLoader={
	$init:function(config){
		//prepare data store
		this.data = {}; 
		this.waitData = smdui.promise.defer();

		if (config)
			this._settings.datatype = config.datatype||"json";
		this.$ready.push(this._load_when_ready);
	},
	_load_when_ready:function(){
		this._ready_for_data = true;
		
		if (this._settings.url)
			this.url_setter(this._settings.url);
		if (this._settings.data)
			this.data_setter(this._settings.data);
	},
	url_setter:function(value){
		value = smdui.proxy.$parse(value);

		if (!this._ready_for_data) return value;
		this.load(value, this._settings.datatype);	
		return value;
	},
	data_setter:function(value){
		if (!this._ready_for_data) return value;
		this.parse(value, this._settings.datatype);
		return true;
	},
	//loads data from external URL
	load:function(url,call){
		var details = arguments[2] || null;

		if(!this.callEvent("onBeforeLoad",[]))
			return smdui.promise.reject();		

		if (typeof call == "string"){	//second parameter can be a loading type or callback
			//we are not using setDriver as data may be a non-datastore here
			this.data.driver = smdui.DataDriver[call];
			call = arguments[2];
		} else if (!this.data.driver)
			this.data.driver = smdui.DataDriver.json;

		//load data by async ajax call
		//loading_key - can be set by component, to ignore data from old async requests
		var callback = [{
			success: this._onLoad,
			error: this._onLoadError
		}];
		
		if (call){
			if (smdui.isArray(call))
				callback.push.apply(callback,call);
			else
				callback.push(call);
		}
		
		//proxy	
		url = smdui.proxy.$parse(url);
		if (url.$proxy && url.load)
			return url.load(this, callback, details);

		//promize
		if (typeof url === "function"){
			return url(details).then(
				smdui.bind(function(data){
					smdui.ajax.$callback(this, callback, "", data, -1);
				}, this),
				smdui.bind(function(x){
					smdui.ajax.$callback(this, callback, "", null, x, true);
				}, this)
			);
		}

		//normal url
		return smdui.ajax(url,callback,this);
	},
	//loads data from object
	parse:function(data,type){
		//[smdui.remote]
		if (data && data.then && typeof data.then == "function"){
			return data.then(smdui.bind(function(data){ 
				if (data && typeof data.json == "function")
					data = data.json();
				this.parse(data, type); 
			}, this));
		}

		//loading data from other component
		if (data && data.sync && this.sync)
			return this._syncData(data);

		if(!this.callEvent("onBeforeLoad",[]))
			return smdui.promise.reject();

		this.data.driver = smdui.DataDriver[type||"json"];
		this._onLoad(data,null);
	},
	_syncData: function(data){
		if(this.data)
			this.data.attachEvent("onSyncApply",smdui.bind(function(){
				if(this._call_onready)
					this._call_onready();
			},this));

		this.sync(data);
	},
	_parse:function(data){
		var parsed, record,
			driver = this.data.driver;

		record = driver.getRecords(data)[0];
		parsed = record?driver.getDetails(record):{};

		if (this.setValues)
			this.setValues(parsed);
		else
			this.data = parsed;
	},
	_onLoadContinue:function(data, text, response, loader){
		if (data){
			if(!this.$onLoad || !this.$onLoad(data, this.data.driver)){
				if(this.data && this.data._parse)
					this.data._parse(data); //datastore
				else
					this._parse(data);
			}
		}
		else
			this._onLoadError(text, response, loader);

		//data loaded, view rendered, call onready handler
		if(this._call_onready)
			this._call_onready();

		this.callEvent("onAfterLoad",[]);
		this.waitData.resolve();
	},
	//default after loading callback
	_onLoad:function(text, response, loader){
		var driver = this.data.driver;
		var data;

		if (loader === -1)
			data = driver.toObject(response);
		else{
			//ignore data loading command if data was reloaded 
			if(this._ajax_queue)
				this._ajax_queue.remove(loader);
			data = driver.toObject(text, response);
		}
			
		if(!data || !data.then)
			this._onLoadContinue(data);
		else if(data.then && typeof data.then == "function")
			data.then(smdui.bind(this._onLoadContinue, this));
	},
	_onLoadError:function(text, xml, xhttp){
		this.callEvent("onAfterLoad",[]);
		this.callEvent("onLoadError",arguments);
		smdui.callEvent("onLoadError", [text, xml, xhttp, this]);
	},
	_check_data_feed:function(data){
		if (!this._settings.dataFeed || this._ignore_feed || !data) return true;
		var url = this._settings.dataFeed;
		if (typeof url == "function")
			return url.call(this, (data.id||data), data);
		url = url+(url.indexOf("?")==-1?"?":"&")+"action=get&id="+encodeURIComponent(data.id||data);
		if(!this.callEvent("onBeforeLoad",[])) 
			return false;
		smdui.ajax(url, function(text,xml,loader){
			this._ignore_feed=true;
			var driver = smdui.DataDriver.json;
			var data = driver.toObject(text, xml);
			if (data)
				this.setValues(driver.getDetails(driver.getRecords(data)[0]));
			else
				this._onLoadError(text,xml,loader);
			this._ignore_feed=false;
			this.callEvent("onAfterLoad",[]);
		}, this);
		return false;
	}
};

/*
	Abstraction layer for different data types
*/

smdui.DataDriver={};
smdui.DataDriver.json={
	//convert json string to json object if necessary
	toObject:function(data){
		if (!data) return null;
		if (typeof data == "string"){
			try{
				if (this.parseDates){
					var isodate = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{1-3})?Z/;
					data = JSON.parse(data, function(key, value){
						if (typeof value == "string"){
							if (isodate.test(value))
								return new Date(value);
						}
						return value;
					});
				} else {
					data =JSON.parse(data);
				}
			} catch(e){
				smdui.log(e);
				smdui.log(data);
				smdui.assert_error("Invalid JSON data for parsing");
				return null;
			}
		}

		return data;
	},
	//get array of records
	getRecords:function(data){
		if (data && data.data)
			data = data.data;

		if (data && !smdui.isArray(data))
			return [data];
		return data;
	},
	//get hash of properties for single record
	getDetails:function(data){
		if (typeof data == "string")
			return { id:(data||smdui.uid()), value:data };
		return data;
	},
	getOptions:function(data){
		return data.collections;
	},
	//get count of data and position at which new data need to be inserted
	getInfo:function(data){
		return {
			size:(data.total_count||0),
			from:(data.pos||0),
			parent:(data.parent||0),
			config:(data.config),
			key:(data.smdui_security)
		};
	},
	child:"data",
	parseDates:false
};

smdui.DataDriver.html={
	/*
		incoming data can be
		 - ID of parent container
		 - HTML text
	*/
	toObject:function(data){
		if (typeof data == "string"){
		 var t=null;
		 if (data.indexOf("<")==-1)	//if no tags inside - probably its an ID
			t = smdui.toNode(data);
		 if (!t){
			t=document.createElement("DIV");
			t.innerHTML = data;
		 }
		 
		 return t.firstChild;
		}
		return data;
	},
	//get array of records
	getRecords:function(node){
		return node.getElementsByTagName(this.tag);
	},
	//get hash of properties for single record
	getDetails:function(data){
		return smdui.DataDriver.xml.tagToObject(data);
	},
	getOptions:function(){ 
		return false;
	},
	//dyn loading is not supported by HTML data source
	getInfo:function(data){
		return {
			size:0,
			from:0
		};
	},
	tag: "LI"
};

smdui.DataDriver.jsarray={
	//parse jsarray string to jsarray object if necessary
	toObject:function(data){
		if (typeof data == "string")
			return JSON.parse(data);
		return data;
	},
	//get array of records
	getRecords:function(data){
		if (data && data.data)
			data = data.data;
		return data;
	},
	//get hash of properties for single record, in case of array they will have names as "data{index}"
	getDetails:function(data){
		var result = {};
		for (var i=0; i < data.length; i++)
		 result["data"+i]=data[i];
		if (this.idColumn !== null)
			result.id = data[this.idColumn];
		 
		return result;
	},
	getOptions:function(){ return false; },
	//dyn loading is not supported by js-array data source
	getInfo:function(data){
		return {
			size:0,
			from:0
		};
	},
	idColumn:null
};

smdui.DataDriver.csv={
	//incoming data always a string
	toObject:function(data){
		return data;
	},
	//get array of records
	getRecords:function(data){
		return data.split(this.row);
	},
	//get hash of properties for single record, data named as "data{index}"
	getDetails:function(data){
		data = this.stringToArray(data);
		var result = {};
		for (var i=0; i < data.length; i++) 
			result["data"+i]=data[i];

		if (this.idColumn !== null)
			result.id = data[this.idColumn];
		 
		return result;
	},
	getOptions:function(){ return false; },
	//dyn loading is not supported by csv data source
	getInfo:function(data){
		return {
			size:0,
			from:0
		};
	},
	//split string in array, takes string surrounding quotes in account
	stringToArray:function(data){
		data = data.split(this.cell);
		for (var i=0; i < data.length; i++)
		 data[i] = data[i].replace(/^[ \t\n\r]*(\"|)/g,"").replace(/(\"|)[ \t\n\r]*$/g,"");
		return data;
	},
	idColumn:null,
	row:"\n",	//default row separator
	cell:","	//default cell separator
};

smdui.DataDriver.xml={
	_isValidXML:function(data){
		if (!data || !data.documentElement)
			return null;
		if (data.getElementsByTagName("parsererror").length)
			return null;
		return data;
	},
	//convert xml string to xml object if necessary
	toObject:function(text, response){
		var data = response ? (response.rawxml ? response.rawxml() : response) :null;
		if (this._isValidXML(data))
			return data;
		if (typeof text == "string")
			data = this.fromString(text.replace(/^[\s]+/,""));
		else
			data = text;

		if (this._isValidXML(data))
			return data;
		return null;
	},
	//get array of records
	getRecords:function(data){
		return this.xpath(data,this.records);
	},
	records:"/*/item",
	child:"item",
	config:"/*/config",
	//get hash of properties for single record
	getDetails:function(data){
		return this.tagToObject(data,{});
	},
	getOptions:function(){ 
		return false;
	},
	//get count of data and position at which new data_loading need to be inserted
	getInfo:function(data){
		
		var config = this.xpath(data, this.config);
		if (config.length)
			config = this.assignTypes(this.tagToObject(config[0],{}));
		else 
			config = null;

		return {
			size:(data.documentElement.getAttribute("total_count")||0),
			from:(data.documentElement.getAttribute("pos")||0),
			parent:(data.documentElement.getAttribute("parent")||0),
			config:config,
			key:(data.documentElement.getAttribute("smdui_security")||null)
		};
	},
	//xpath helper
	xpath:function(xml,path){
		if (window.XPathResult){	//FF, KHTML, Opera
		 var node=xml;
		 if(xml.nodeName.indexOf("document")==-1)
		 xml=xml.ownerDocument;
		 var res = [];
		 var col = xml.evaluate(path, node, null, XPathResult.ANY_TYPE, null);
		 var temp = col.iterateNext();
		 while (temp){ 
			res.push(temp);
			temp = col.iterateNext();
		}
		return res;
		}	
		else {
			var test = true;
			try {
				if (typeof(xml.selectNodes)=="undefined")
					test = false;
			} catch(e){ /*IE7 and below can't operate with xml object*/ }
			//IE
			if (test)
				return xml.selectNodes(path);
			else {
				//there is no interface to do XPath
				//use naive approach
				var name = path.split("/").pop();

				return xml.getElementsByTagName(name);
			}
		}
	},
	assignTypes:function(obj){
		for (var k in obj){
			var test = obj[k];
			if (typeof test == "object")
				this.assignTypes(test);
			else if (typeof test == "string"){
				if (test === "") 
					continue;
				if (test == "true")
					obj[k] = true;
				else if (test == "false")
					obj[k] = false;
				else if (test == test*1)
					obj[k] = obj[k]*1;
			}
		}
		return obj;
	},
	//convert xml tag to js object, all subtags and attributes are mapped to the properties of result object
	tagToObject:function(tag,z){
		var isArray = tag.nodeType == 1 && tag.getAttribute("stack");
		var hasSubTags = 0;

		if (!isArray){
			z=z||{};
			

			//map attributes
			var a=tag.attributes;
			if(a && a.length)
				for (var i=0; i<a.length; i++){
			 		z[a[i].name]=a[i].value;
			 		hasSubTags = 1;
			 	}

			//map subtags
			var b=tag.childNodes;
			for (var i=0; i<b.length; i++)
				if (b[i].nodeType==1){
					var name = b[i].tagName;
					if (z[name]){
						if (typeof z[name].push != "function")
							z[name] = [z[name]];
						z[name].push(this.tagToObject(b[i],{}));
					} else
						z[name]=this.tagToObject(b[i],{});	//sub-object for complex subtags
					hasSubTags = 2;
				}

			if (!hasSubTags)
				return this.nodeValue(tag);
			//each object will have its text content as "value" property
			//only if has not sub tags
			if (hasSubTags < 2)
				z.value = z.value||this.nodeValue(tag);

		} else {
			z = [];
			var b=tag.childNodes;
			for (var i=0; i<b.length; i++)
				if (b[i].nodeType==1)
					z.push(this.tagToObject(b[i],{}));
		}

		return z;
	},
	//get value of xml node 
	nodeValue:function(node){
		if (node.firstChild){
			return node.firstChild.wholeText || node.firstChild.data;
		}
		return "";
	},
	//convert XML string to XML object
	fromString:function(xmlString){
		try{
			if (window.DOMParser)		// FF, KHTML, Opera
				return (new DOMParser()).parseFromString(xmlString,"text/xml");
			if (window.ActiveXObject){	// IE, utf-8 only 
				var temp=new ActiveXObject("Microsoft.xmlDOM");
				temp.loadXML(xmlString);
				return temp;
			}
		} catch(e){
			smdui.assert_error(e);
			return null;
		}
		smdui.assert_error("Load from xml string is not supported");
	}
};

smdui.debug_code(function(){
	smdui.debug_load_event = smdui.attachEvent("onLoadError", function(text, xml, xhttp, owner){
		text = text || "[EMPTY DATA]";
		var error_text = "Data loading error, check console for details";
		if (text.indexOf("<?php") === 0)
			error_text = "PHP support missed";
		else if (text.indexOf("smdui_ERROR:") === 0)
			error_text = text.replace("smdui_ERROR:","");

		if (smdui.message)
			smdui.message({
				type:"debug",
				text:error_text,
				expire:-1
			});
		if (window.console){
			var logger = window.console;
			logger.log("Data loading error");
			logger.log("Object:", owner);
			logger.log("Response:", text);
			logger.log("XHTTP:", xhttp);
		}
	});

	smdui.ready(function(){
		var path = document.location.href;
		if (path.indexOf("file:")===0){
			if (smdui.message)
				smdui.message({
					type:"error", 
					text:"Please open sample by http,<br>not as file://",
					expire:-1
				});
			else 
				window.alert("Please open sample by http, not as file://");
		}
	});
	
});

//UI interface
smdui.BaseBind = {
	bind:function(target, rule, format){
		if (!this.attachEvent)
			smdui.extend(this, smdui.EventSystem);

		if (typeof target == 'string')
			target = smdui.$$(target);
			
		if (target._initBindSource) target._initBindSource();
		if (this._initBindSource) this._initBindSource();

		
			
		if (!target.getBindData)
			smdui.extend(target, smdui.BindSource);

		this._bind_ready();

		target.addBind(this._settings.id, rule, format);
		this._bind_source = target._settings.id;

		if (smdui.debug_bind)
			smdui.log("[bind] "+this.name+"@"+this._settings.id+" <= "+target.name+"@"+target._settings.id);

		var target_id = this._settings.id;
		//FIXME - check for touchable is not the best solution, to detect necessary event
		this._bind_refresh_handler = this.attachEvent(this.touchable?"onAfterRender":"onBindRequest", function(){
			return target.getBindData(target_id);
		});

		if (this.refresh && this.isVisible(this._settings.id))
			this.refresh();
	},
	unbind:function(){
		if (this._bind_source){
			var target = smdui.$$(this._bind_source);
			if (target)
				target.removeBind(this._settings.id);
			this.detachEvent(this._bind_refresh_handler);
			this._bind_source = null;
		}
	},
	_bind_ready:function(){
		var config = this._settings;
		if (this.filter){
			var key = config.id;
			this.data._on_sync = smdui.bind(function(){
				smdui.$$(this._bind_source)._bind_updated[key] = false;
			}, this);
		}

		var old_render = this.render;
		this.render = function(){
			if (this._in_bind_processing) return;
			
			this._in_bind_processing = true;
			var result = this.callEvent("onBindRequest");
			this._in_bind_processing = false;
			
			return old_render.apply(this, ((result === false)?arguments:[]));
		};

		if (this.getValue||this.getValues)
			this.save = function(data){
				var source = smdui.$$(this._bind_source);
				if (data)
					source.setBindData(data);
				else {
					if (this.validate && !this.validate()) return false;
					var values = this.getValue?this.getValue:this.getValues();
					source.setBindData(values,this._settings.id);
					//reset form, so it will be counted as saved
					if (this.setDirty)
						this.setDirty(false);
				}
			};

		this._bind_ready = function(){};
	}
};

//bind interface
smdui.BindSource = {
	$init:function(){
		this._bind_hash = {};		//rules per target
		this._bind_updated = {};	//update flags
		this._ignore_binds = {};
		
		//apply specific bind extension
		this._bind_specific_rules(this);
	},
	saveBatch:function(code){
		this._do_not_update_binds = true;
		code.call(this);
		this._do_not_update_binds = false;
		this._update_binds();
	},
	setBindData:function(data, key){
		//save called, updating master data
		if (key)
			this._ignore_binds[key] = true;

		if (smdui.debug_bind)
				smdui.log("[bind:save] "+this.name+"@"+this._settings.id+" <= "+"@"+key);
		if (this.setValue)
			this.setValue(data);
		else if (this.setValues)
			this.setValues(data);
		else {
			var id = this.getCursor();
			if (id)
				this.updateItem(id, data);
			else
				this.add(data);
		}
		this.callEvent("onBindUpdate", [data, key]);		
		if (this.save)
			this.save();
		
		if (key)
			this._ignore_binds[key] = false;
	},
	//fill target with data
	getBindData:function(key, update){
		//fire only if we have data updates from the last time
		if (this._bind_updated[key]) return false;
		var target = smdui.$$(key);
		//fill target only when it visible
		if (target.isVisible(target._settings.id)){
			this._bind_updated[key] = true;
			if (smdui.debug_bind)
				smdui.log("[bind:request] "+this.name+"@"+this._settings.id+" => "+target.name+"@"+target._settings.id);
			this._bind_update(target, this._bind_hash[key][0], this._bind_hash[key][1]); //trigger component specific updating logic
			if (update && target.filter)
				target.refresh();
		}
	},
	//add one more bind target
	addBind:function(source, rule, format){
		this._bind_hash[source] = [rule, format];
	},
	removeBind:function(source){
		delete this._bind_hash[source];
		delete this._bind_updated[source];
		delete this._ignore_binds[source];
	},
	//returns true if object belong to "collection" type
	_bind_specific_rules:function(obj){
		if (obj.filter)
			smdui.extend(this, smdui.CollectionBind);
		else if (obj.setValue)
			smdui.extend(this, smdui.ValueBind);
		else
			smdui.extend(this, smdui.RecordBind);
	},
	//inform all binded objects, that source data was updated
	_update_binds:function(){
		if (!this._do_not_update_binds)
			for (var key in this._bind_hash){
				if (this._ignore_binds[key]) continue;
				this._bind_updated[key] = false;
				this.getBindData(key, true);
			}
	},
	//copy data from source to the target
	_bind_update_common:function(target, rule, data){
		if (target.setValue)
			target.setValue((data&&rule)?data[rule]:data);
		else if (!target.filter){
			if (!data && target.clear)
				target.clear();
			else {
				if (target._check_data_feed(data))
					target.setValues(smdui.clone(data));
			}
		} else {
			target.data.silent(function(){
				this.filter(rule,data);
			});
		}
		target.callEvent("onBindApply", [data,rule,this]);
	}
};

//pure data objects
smdui.DataValue = smdui.proto({
	name:"DataValue",
	isVisible:function(){ return true; },
	$init:function(config){ 
		if (!config || smdui.isUndefined(config.value))
			this.data = config||"";

		var id = (config&&config.id)?config.id:smdui.uid();
		this._settings = { id:id };
		smdui.ui.views[id] = this;
	},
	setValue:function(value){
		this.data = value;
		this.callEvent("onChange", [value]);
	},
	getValue:function(){
		return this.data;
	},
	refresh:function(){ this.callEvent("onBindRequest"); }
}, smdui.EventSystem, smdui.BaseBind);

smdui.DataRecord = smdui.proto({
	name:"DataRecord",
	isVisible:function(){ return true; },
	$init:function(config){
		this.data = config||{}; 
		var id = (config&&config.id)?config.id:smdui.uid();
		this._settings = { id:id };
		smdui.ui.views[id] = this;
	},
	getValues:function(){
		return this.data;
	},
	setValues:function(data, update){
		this.data = update?smdui.extend(this.data, data, true):data;
		this.callEvent("onChange", [data]);
	},
	refresh:function(){ this.callEvent("onBindRequest"); }
}, smdui.EventSystem, smdui.BaseBind, smdui.AtomDataLoader, smdui.Settings);

smdui.ValueBind={
	$init:function(){
		this.attachEvent("onChange", this._update_binds);
	},
	_bind_update:function(target, rule, format){
		rule = rule || "value";
		var data = this.getValue()||"";
		if (format) data = format(data);
		
		if (target.setValue)
			target.setValue(data);
		else if (!target.filter){
			var pod = {}; pod[rule] = data;
			if (target._check_data_feed(data))
				target.setValues(pod);
		} else{
			target.data.silent(function(){
				this.filter(rule,data);
			});
		}
		target.callEvent("onBindApply", [data,rule,this]);
	}
};

smdui.RecordBind={
	$init:function(){
		this.attachEvent("onChange", this._update_binds);		
	},
	_bind_update:function(target, rule, format){
		var data = this.getValues()||null;
		if (format)
			data = format(data);
		this._bind_update_common(target, rule, data);
	}
};

smdui.CollectionBind={
	$init:function(){
		this._cursor = null;
		this.attachEvent("onSelectChange", function(data){
			var sel = this.getSelectedId();
			this.setCursor(sel?(sel.id||sel):null);
		});
		this.attachEvent("onAfterCursorChange", this._update_binds);		
		this.attachEvent("onAfterDelete", function(id){
			if (id == this.getCursor())
				this.setCursor(null);
		});
		this.data.attachEvent("onStoreUpdated", smdui.bind(function(id, data, mode){
			//paint - ignored
			//delete - handled by onAfterDelete above
			if (id && id == this.getCursor() && mode != "paint" && mode != "delete")
				this._update_binds();
			
		},this));
		this.data.attachEvent("onClearAll", smdui.bind(function(){
			this._cursor = null;
		},this));
		this.data.attachEvent("onIdChange", smdui.bind(function(oldid, newid){
			if (this._cursor == oldid){
				this._cursor = newid;
				this._update_binds();
			}
		},this));
	},
	refreshCursor:function(){
		if (this._cursor)
			this.callEvent("onAfterCursorChange",[this._cursor]);
	},
	setCursor:function(id){
		if (id == this._cursor || (id !== null && !this.getItem(id))) return;
		
		this.callEvent("onBeforeCursorChange", [this._cursor]);
		this._cursor = id;
		this.callEvent("onAfterCursorChange",[id]);
	},
	getCursor:function(){
		return this._cursor;
	},
	_bind_update:function(target, rule, format){
		if (rule == "$level" && this.data.getBranch)
			return (target.data || target).importData(this.data.getBranch(this.getCursor()));

		var data = this.getItem(this.getCursor())|| this._settings.defaultData || null;
		if (rule == "$data"){
			if (typeof format === "function")
				format.call(target, data, this);
			else
				target.data.importData(data?data[format]:[]);
			target.callEvent("onBindApply", [data,rule,this]);
		} else {
			if (format)
				data = format(data);
			this._bind_update_common(target, rule, data);
		}
	}
};	



/*
	REnders single item. 
	Can be used for elements without datastore, or with complex custom rendering logic
	
	@export
		render
*/



smdui.AtomRender={
	//convert item to the HTML text
	_toHTML:function(obj){
		if (obj.$empty )
			return "";
		return this._settings.template(obj, this);
	},
	//render self, by templating data object
	render:function(){
		var cfg = this._settings;
		if (this.isVisible(cfg.id)){
			if (smdui.debug_render)
				smdui.log("Render: "+this.name+"@"+cfg.id);
			if (!this.callEvent || this.callEvent("onBeforeRender",[this.data])){
				if (this.data && !cfg.content){
					//it is critical to have this as two commands
					//its prevent destruction race in Chrome
					this._dataobj.innerHTML = "";
					this._dataobj.innerHTML = this._toHTML(this.data);
				}
				if (this.callEvent) this.callEvent("onAfterRender",[]);
			}
			return true;
		}
		return false;
	},
	sync:function(source){
		this._backbone_sync = false;
		if (source.name != "DataStore"){
			if (source.data && source.name == "DataStore"){
				source = source.data;
			} else {
				this._backbone_sync = true;
			}
		}
			

		if (this._backbone_sync)
			source.bind("change", smdui.bind(function(data){
				if (data.id == this.data.id){
					this.data = data.attributes;
					this.refresh();
				}
			}, this));
		else
			source.attachEvent("onStoreUpdated", smdui.bind(function(id){
				if (!id || id == this.data.id){
					this.data = source.pull[id];
					this.refresh();
				}
			}, this));
	},
	template_setter:smdui.template
};

smdui.SingleRender=smdui.proto({
    template_setter:function(value){
		this.type.template=smdui.template(value);
	},
	//convert item to the HTML text
	_toHTML:function(obj){
		var type = this.type;
		return (type.templateStart?type.templateStart(obj,type):"") + type.template(obj,type) + (type.templateEnd?type.templateEnd(obj,type):"");
	},
	customize:function(obj){
		smdui.type(this,obj);
	}
}, smdui.AtomRender);

smdui.UIManager = {
	_view: null,
	_hotkeys: {},
	_focus_time:0,
	_controls: {
		'enter': 13,
		'tab': 9,
		'esc': 27,
		'escape': 27,
		'up': 38,
		'down': 40,
		'left': 37,
		'right': 39,
		'pgdown': 34,
		'pagedown': 34,
		'pgup': 33,
		'pageup': 33,
		'end': 35,
		'home': 36,
		'insert': 45,
		'delete': 46,
		'backspace': 8,
		'space': 32,
		'meta': 91,
		'win': 91,
		'mac': 91,
		'multiply': 106,
		'add': 107,
		'subtract': 109,
		'decimal': 110,
		'divide': 111,
		'scrollock':145,
		'pausebreak':19,
		'numlock':144,
		'5numlocked':12,
		'shift':16,
		'capslock':20
	},
	_inputs:{
		"input": 1,
		"button":1,
		"textarea":1,
		"select":1
	},
	_enable: function() {
		// attaching events here
		smdui.event(document.body, "click", smdui.bind(this._focus_click, this));
		smdui.event(document, "keydown", smdui.bind(this._keypress, this));

		if (document.body.addEventListener)
			smdui.event(document.body, "focus", this._focus_tab, { capture:true, bind: this });

		smdui.destructors.push({obj:this});
	},
	destructor:function(){
		smdui.UIManager._view = null;
	},
	getFocus: function() {
		return this._view;
	},
	_focus_action:function(view){
		this._focus_was_there = this._focus_was_there || view._settings.id;
	},
	setFocus: function(view, only_api){
		//view can be empty
		view = smdui.$$(view);
		//unfocus if view is hidden
		if (view && !view.$view) view = null;

		//store last click time, it is necessary to prevent refocusing
		//for example when user moves focus from onclick handler somewher
		//and we want to prevent autofocusing, when event will reach document.body
		this._focus_time = smdui._focus_time = new Date();

		if (this._view === view) return true;
		if (this._view && this._view.callEvent)
			this._view.callEvent("onBlur", [this._view]);

		if (view && view.callEvent)
			view.callEvent("onFocus", [view, this._view]);
		smdui.callEvent("onFocusChange", [view, this._view]);

		if (this._view && this._view.blur && !only_api) this._view.blur();
		this._view = view;
		if (view && view.focus && !only_api) view.focus();
		return true;
	},
	applyChanges: function(element){
		var view = this.getFocus();
		if (view && view != element && view._applyChanges)
			view._applyChanges(element);
	},
	hasFocus: function(view) {
		return (view === this._view) ? true : false;
	},
	_focus: function(e, dont_clear) {
		var view = smdui.html.locate(e, "view_id") || this._focus_was_there;

		//if html was repainted we can miss the view, so checking last processed one
		view = smdui.$$(view);
		this._focus_was_there = null;

		//set timer, to fix issue with Android input focusin
		smdui._focus_time = new Date();

		if (view == this._view) return;

		if (!dont_clear)
			this._focus_was_there = null;
		
		if (view){
			view = smdui.$$(view);
			if (this.canFocus(view)){
				//[ACTIVECONTENT] focus operations for active content
				if (view.getNode) view.getNode(e);
				this.setFocus(view);
			}
		} else if (!dont_clear)
			this.setFocus(null);

		return true;
	},
	_focus_click:function(e){
		// if it was onfocus/onclick less then 100ms behore then we ignore it
		if ((new Date())-this._focus_time < 100) {
			this._focus_was_there = null;
			return false;
		}
		return this._focus(e);
	},
	_focus_tab: function(e) {
		if(!this._inputs[e.target.nodeName.toLowerCase()])
			return false;
		return this._focus(e, true);
	},
	canFocus:function(view){
		return view.isVisible() && view.isEnabled();
	},

	_moveChildFocus: function(check_view){
		var focus = this.getFocus();
		//we have not focus inside of closing item
		if (check_view && !this._is_child_of(check_view, focus))
			return false;

		if (!this._focus_logic("getPrev", check_view))
			this._view = null;
	},
	_translation_table:{
	},
	_is_child_of: function(parent, child) {
		if (!parent) return false;
		if (!child) return false;
		while (child) {
			if (child === parent) return true;
			child = child.getParentView();
		}
		return false;
	},
	_keypress_timed:function(){
		if (this && this.callEvent)
			this.callEvent("onTimedKeyPress",[]);
	},
	_isNumPad: function(code){
		return code < 112 &&  code>105;
	},
	_keypress: function(e) {
		var code = e.which || e.keyCode;
		if(code>95 && code< 106)
			code -= 48; //numpad support (numbers)
		code = this._translation_table[code] || code;
		
		var ctrl = e.ctrlKey;
		var shift = e.shiftKey;
		var alt = e.altKey;
		var meta = e.metaKey;
		var codeid = this._keycode(code, ctrl, shift, alt, meta);
		var view = this.getFocus();
		if (view && view.callEvent) {
			if (view.callEvent("onKeyPress", [code,e]) === false)
				smdui.html.preventEvent(e);
			if (view.hasEvent("onTimedKeyPress")){
				clearTimeout(view._key_press_timeout);
				view._key_press_timeout = smdui.delay(this._keypress_timed, view, [], (view._settings.keyPressTimeout||250));
			}
		}

		if(!this._isNumPad(code))
			codeid = this._keycode(String.fromCharCode(code), ctrl, shift, alt, meta);
		//flag, that some non-special key was pressed
		var is_any = !ctrl && !alt && !meta && (code!=9)&&(code!=27)&&(code!=13);

		if (this._check_keycode(codeid, is_any, e) === false) {
			smdui.html.preventEvent(e);
			return false;
		}
	},

	// dir - getNext or getPrev
	_focus_logic: function(dir) {
		if (!this.getFocus()) return null;

		dir = dir || "getNext";
		var next = this.getFocus();
		var start = next;
		var marker = smdui.uid();

		while (true) {
			next = this[dir](next);
			// view with focus ability
			if (next && this.canFocus(next))
				return this.setFocus(next);

			// elements with focus ability not found
			if (next === start || next.$fmarker == marker)
				return null;
			
			//prevents infinity loop
			next.$fmarker = marker;
		}
	},
	_tab_logic:function(view, e){
		var mode = !e.shiftKey;
		smdui.UIManager._tab_time = new Date();
		if (view && view._custom_tab_handler && !view._custom_tab_handler(mode, e))
			return false;

		if (view && view._in_edit_mode){
			if (view.editNext)
				return view.editNext(mode);
			else if (view.editStop){
				view.editStop();
				return true;
			}
		} else
			smdui.delay(function(){
				smdui.UIManager.setFocus(smdui.$$(document.activeElement), true);
			},1);
	},
	getTop: function(id) {
		var next, view = smdui.$$(id);

		while (view && (next = view.getParentView()))
			view = next;
		return view;
	},

	getNext: function(view, _inner_call) {
		var cells = view.getChildViews();
		//tab to first children
		if (cells.length && !_inner_call) return cells[0];

		//unique case - single view without child and parent
		var parent = view.getParentView();
		if (!parent)
			return view;

		var p_cells = parent.getChildViews();
		if (p_cells.length){
			var index = smdui.PowerArray.find.call(p_cells, view)+1;
			while (index < p_cells.length) {
				//next visible child
				if (this.canFocus(p_cells[index])) 
					return p_cells[index];

				index++;
			}
		} 

		//sibling of parent
		return this.getNext(parent, true);
	},

	getPrev: function(view, _inner_call) {
		var cells = view.getChildViews();
		//last child of last child
		if (cells.length && _inner_call) 
			return this.getPrev(cells[cells.length - 1], true);
		if (_inner_call) return view;

		//fallback from top to bottom
		var parent = view.getParentView();
		if (!parent) return this.getPrev(view, true);


		var p_cells = parent.getChildViews();
		if (p_cells) {
			var index = smdui.PowerArray.find.call(p_cells, view)-1;
			while (index >= 0) {
				if (this.canFocus(p_cells[index]))
					return this.getPrev(p_cells[index], true);
				index--;
			}
		}

		return parent;
	},
	addHotKey: function(keys, handler, view) {
		smdui.assert(handler, "Hot key handler is not defined");
		var pack = this._parse_keys(keys);
		smdui.assert(pack.letter, "Unknown key code");
		if (!view) view = null;
		pack.handler = handler;
		pack.view = view;
		

		var code = this._keycode(pack.letter, pack.ctrl, pack.shift, pack.alt, pack.meta);
		if (!this._hotkeys[code]) this._hotkeys[code] = [];
		this._hotkeys[code].push(pack);

		return keys;
	},
	removeHotKey: function(keys, func, view){
		var pack = this._parse_keys(keys);
		var code = this._keycode(pack.letter, pack.ctrl, pack.shift, pack.alt, pack.meta);
		if (!func && !view)
			delete this._hotkeys[code];
		else {
			var t = this._hotkeys[code];
			if (t){
				for (var i = t.length - 1; i >= 0; i--) {
					if (view && t[i].view !== view) continue;
					if (func && t[i].handler !== func) continue;
					t.splice(i,1);
				}
				if (!t.length)
					delete this._hotkeys[code];
			}

		}
	},
	_keycode: function(code, ctrl, shift, alt, meta) {
		return code+"_"+["", (ctrl ? '1' : '0'), (shift ? '1' : '0'), (alt ? '1' : '0'), (meta ? '1' : '0')].join('');
	},

	_check_keycode: function(code, is_any, e){
		var focus = this.getFocus();
		if (this._hotkeys[code])
			return  this._process_calls(this._hotkeys[code], focus, e);
		else if (is_any && this._hotkeys["ANY_0000"])
			return  this._process_calls(this._hotkeys["ANY_0000"], focus, e);

		return true;
	},
	_process_calls:function(calls, focus, e){
		for (var i = 0; i < calls.length; i++) {
			var key = calls[i];
			var call = false;
			if ((key.view !== null) &&		//common hot-key
				(focus !== key.view) &&		//hot-key for current view
				//hotkey for current type of view
				(typeof(key.view) !== 'string' || !focus || focus.name !== key.view)) continue;

			var temp_result = key.handler(focus, e);
			if (!!temp_result === temp_result) return temp_result;
		}
		return true;
	},
	_parse_keys: function(keys) {
		var controls = this._controls;
		var parts = keys.toLowerCase().split(/[\+\-_]/);
		var ctrl, shift, alt, meta;
		ctrl = shift = alt = meta = 0;
		var letter = "";
		for (var i = 0; i < parts.length; i++) {
			if (parts[i] === 'ctrl') ctrl = 1;
			else if (parts[i] === 'shift') shift = 1;
			else if (parts[i] === 'alt') alt = 1;
			else if (parts[i] === 'command') meta = 1;
			else {
				if (controls[parts[i]]) {
					var code = controls[parts[i]];
					if(this._isNumPad(code))
						letter = code.toString();
					else
						letter = String.fromCharCode(code);
				} else {
					letter = parts[i];
				}
			}
		}
		return {
			letter: letter.toUpperCase(),
			ctrl: ctrl,
			shift: shift,
			alt: alt,
			meta: meta,
			debug:keys
		};
	}
};

smdui.ready(function() {
	smdui.UIManager._enable();

	smdui.UIManager.addHotKey("enter", function(view, ev){
		if (view && view.editStop && view._in_edit_mode){
			view.editStop();
			return true;
		} else if (view && view.touchable){
			var form = view.getFormView();
			if (form && !view._skipSubmit)
				form.callEvent("onSubmit",[view,ev]);
		}
	});
	smdui.UIManager.addHotKey("esc", function(view){
		if (view){
			if (view.editCancel && view._in_edit_mode){
				view.editCancel();
				return true;
			}
			var top = view.getTopParentView();
			if (top && top.setPosition)
				top._hide();
		}
	});
	smdui.UIManager.addHotKey("shift+tab", smdui.UIManager._tab_logic);
	smdui.UIManager.addHotKey("tab", smdui.UIManager._tab_logic);
});

smdui.IdSpace = {
	$init:function(){
		this._elements = {};
		this._translate_ids = {};
		this.getTopParentView = this._get_self = smdui.bind(function(){ return this;}, this);

		this._run_inner_init_logic();
		this.$ready.push(this._run_after_inner_init_logic);
	},
	$$:function(id){
		return this._elements[id];
	},
	innerId:function(id){
		return this._translate_ids[id];
	},
	_run_inner_init_logic:function(callback){
		this._prev_global_col = smdui._global_collection;
		smdui._global_collection = this;
	},
	_run_after_inner_init_logic:function(temp){
		for (var name in this._elements){
			var input = this._elements[name];
			if (this.callEvent && input.mapEvent && !input._evs_map.onitemclick)
				input.mapEvent({
					onitemclick:this
				});
			input.getTopParentView = this._get_self;
		}

		smdui._global_collection = this._prev_global_col;
		this._prev_global_col = 0;
	},
	_destroy_child:function(id){
		delete this._elements[id];
	},
	ui:function(){
		this._run_inner_init_logic();
		var temp = smdui.ui.apply(smdui, arguments);
		this._run_after_inner_init_logic();
		return temp;
	}
};


(function(){

var resize = [];
var ui = smdui.ui;
//界面初始化入口
if (!smdui.ui){
	ui = smdui.ui = function(config, parent, id){
		smdui._ui_creation = true;
		var multiset = smdui.isArray(config);
		var node = smdui.toNode((config.container||parent)||document.body);

		// solve problem with non-unique ids
		if(node._settings)
			id = _correctId(node, multiset, id);

		var top_node;
		var body_child = (node == document.body);
		if (config._settings || (node && multiset)){
			top_node = config;
		} else {
			if (node && body_child)
				config.$topView = true;
			if (!config._inner)
				config._inner = {};

			top_node = ui._view(config);
		}

		if (body_child && !top_node.setPosition && !top_node.$apiOnly)
			smdui.ui._fixHeight();

		if (top_node._settings && top_node._settings._hidden && !node.$view){
			top_node._settings._container = node;
		} else if (!top_node.$apiOnly){
			if (node.appendChild)
				_appendDom(node, top_node, config);
			else if (node.destructor){
				var target = node;

				//addView or view moving with target id
				if (!id && id!==0 && !smdui.isArray(top_node)){
					id = node;
					node = node.getParentView();
				}

				//if target supports view adding
				if (node && node._replace){
					//if source supports view removing
					if (top_node.getParentView && top_node.getParentView())
						top_node.getParentView()._remove(top_node);

					node._replace(top_node, id);
				} else {
					var parent = target.$view.parentNode;
					target.destructor();
					_appendDom(parent, top_node, config);
				}
			} else
				smdui.assert_error("Not existing parent:"+config.container);
		}
		
		smdui._ui_creation = false;
		return top_node;
	};

	var _appendDom = function(node, top_node, config){
		node.appendChild(top_node._viewobj);
		//resize window with position center or top
		//do not resize other windows and elements
		// which are attached to custom html containers
		if (((!top_node.setPosition || top_node._settings.fullscreen) && node == document.body) || top_node._settings.position )
			resize.push(top_node._destructor_handler);
		if (!config.skipResize)
			top_node.adjust();
	};

	var _correctId = function(target, multiset, id){
		//replace view
		var views = [target];
		//replace content of layout
		if (multiset)
			views = target.getChildViews();
		//replace content of window
		else if (target._body_cell)
			views = [target._body_cell];
		//add cell in layout by number
		else if (typeof id == "number"){
			return id;
		//replace cell in layout by id
		} else if (id){
			views = [smdui.$$(id)];
			_deleteIds(views);
			return views[0].config.id;
		}

		_deleteIds(views);
		return id;
	};

	var _deleteIds = function(views){
		for (var i = views.length - 1; i >= 0; i--){
			//remove original id
			delete smdui.ui.views[views[i].config.id];
			//create temp id
			views[i].config.id = "x"+smdui.uid();
			smdui.ui.views[views[i].config.id] = views[i];
			//process childs
			_deleteIds(views[i].getChildViews());
		}
	};
}

smdui.ui.animate = function(ui, parent, config){
	var pobj = smdui.$$(parent);
	if (pobj){
		var aniset = config || { type:"slide", direction:"left" };
		var d = pobj._viewobj.cloneNode(true);
		var view = smdui.ui(ui, parent);

		view._viewobj.parentNode.appendChild(d);
		var line = smdui.animate.formLine(
			view._viewobj,
			d,
			aniset
		);

		aniset.callback = function(){
			smdui.animate.breakLine(line);
		};
		smdui.animate(line, aniset);

		return view;
	}
};

smdui.ui.animateView = function(view, stateHandler, config){
	view = smdui.$$(view);
	if (view){
		config = config || { type:"slide", direction:"left" };

		var getHTML = function(view){
			var el = view._viewobj;
			var css = el.className;
			var content =el.innerHTML;
			return "<div class='"+css+"' style='width:"+el.offsetWidth+"px;height:"+el.offsetHeight+"px;'>"+content+"</div>";
		};

		// get 'display' state of child nodes
		var display = [];
		for(var i =0; i< view._viewobj.childNodes.length;i++){
			var node = view._viewobj.childNodes[i];
			var value = node.currentStyle ?node.currentStyle.display : getComputedStyle(node, null).display;
			display.push(value||"");
		}
		// get current html content
		var currentState = getHTML(view);

		// apply new state
		if(typeof stateHandler == "function"){
			stateHandler.call(this);
		}

		// get new html content
		var newState = getHTML(view);

		// insert elements into the view
		var tempParent = view._viewobj.insertBefore(smdui.html.create("DIV",{
			"class" : "smdui_view_animate",
			"style" : "width:"+view._viewobj.offsetWidth+"px;height:"+view._viewobj.offsetHeight+"px;"
		}, newState+currentState),view._viewobj.firstChild);

		// hide child nodes
		for(var i =1; i< view._viewobj.childNodes.length;i++){
			view._viewobj.childNodes[i].style.display = "none";
		}

		// animate inserted elements
		var line = smdui.animate.formLine(
			tempParent.childNodes[0],
			tempParent.childNodes[1],
			config
		);
		config.callback = function(){
			if(tempParent){
				view._viewobj.removeChild(tempParent);
				tempParent = null;
				// restore 'display' state of child nodes
				for(var i =0; i< view._viewobj.childNodes.length;i++){
					view._viewobj.childNodes[i].style.display = display[i];
				}
			}
		};
		smdui.animate(line, config);

		return view;
	}
};

/*called in baseview $init for calculate scrollSize*/
smdui.ui._detectScrollSize = function(){
	var div = smdui.html.create("div");
	div.className = "smdui_skin_mark";
	div.style.cssText="position:absolute;left:-1000px;width:100px;padding:0px;margin:0px;min-height:100px;overflow-y:scroll;";

	document.body.appendChild(div);
	var width = div.offsetWidth-div.clientWidth;
	var skin = { 110:"air", 120:"aircompact", 130:"clouds", 140:"web", 150:"terrace", 160:"metro", 170:"light", 180:"glamour", 190:"touch", 200:"flat" , 210:"compact", 220:"material", 230: "contrast" }[Math.floor(div.offsetHeight/10)*10];
	document.body.removeChild(div);

	if (skin){
		var skinobj = smdui.skin[skin];
		if (skinobj && skinobj != smdui.skin.$active)
			smdui.skin.set(skin);
	}

	if (smdui.env.$customScroll) return 0;
	return width;
};
smdui.ui.scrollSize = ((smdui.env.touch||smdui.env.$customScroll)?0:17);
smdui.ready(function(){
	var size = smdui.ui._detectScrollSize();
	smdui.ui.scrollSize = smdui.env.touch ? 0 : size;
});

smdui.ui._uid = function(name){
	return "$"+name+(this._namecount[name] = (this._namecount[name]||0)+1);
};
smdui.ui._namecount = {};

smdui.ui._fixHeight = function (){
	smdui.html.addStyle("html, body{ height:100%; }");
	document.body.className+=" smdui_full_screen";
	smdui.ui._fixHeight = function(){};
	smdui.Touch.limit(false);
};
smdui.ui.resize = function(){
	smdui.UIManager.applyChanges();
	smdui.callEvent("onClick",[]);
	if (!smdui.ui.$freeze)
		for (var i=resize.length - 1; i>=0; i--){
			if (resize[i].obj)
				resize[i].obj.adjust();
		}
};
smdui.ui.each = function(parent, logic, master, include){
	if (parent){
		var children = include ? [parent] : parent.getChildViews();
		for (var i = 0; i < children.length; i++){
			if (logic.call((master || smdui), children[i]) !== false)
				smdui.ui.each(children[i], logic, master);
		}
	}
};
smdui.event(window, "resize", function() {
	// check for virtual keyboard
	if(smdui.env.touch && ( smdui.edit_open_time && (new Date())-smdui.edit_open_time < 750 || smdui._focus_time && (new Date())-smdui._focus_time < 750)){
		//workaround for android chrome bug with scrolling to the focused input if overflow:hidden on container
		if(smdui.env.isWebKit && document.activeElement){
			var wactiv = smdui.$$(document.activeElement);
			if (wactiv && wactiv.getInputNode && document.activeElement.scrollIntoView)
				document.activeElement.scrollIntoView();
		}
		return;
	} else {
		smdui.ui.resize();
	}
});

ui._delays = {};
ui.delay = function(config){
	smdui.ui._delays[config.id] = config;
};
ui.hasMethod = function(view, method){
	var obj = smdui.ui[view];
	if (!obj) return false;

	if (obj.$protoWait)
		obj = obj.call(smdui);

	return !!smdui.ui[view].prototype[method];
};
smdui.ui.zIndex = function(){
	return smdui.ui.zIndexBase++;
};
smdui.ui.zIndexBase = 100;

ui._view = function(config){
	smdui.assert_config(config);
	if (config.view){
		var view = config.view;
		smdui.assert(ui[view], "unknown view:"+view);
		return new ui[view](config);
	} else if (config.rows || config.cols){
		var cells = config.rows||config.cols;
		var accordion = false;
		for (var i=0; i<cells.length; i++){
			if (cells[i].body && !cells[i].view && !cells[i].align)
				accordion = true;
		}
		if (accordion){
			return new ui.headerlayout(config);
		} else
			return new ui.layout(config);
	}
	else if (config.cells)
		return new ui.multiview(config);
	else if (config.template || config.content)
		return new ui.template(config);	
	else if (config.align && config.body){
		return new ui.align(config);
	} else return new ui.spacer(config);
};

ui.views = {};
smdui.$$ = function(id){
	if (!id) return null;
	
	if (ui.views[id]) return ui.views[id];
	if (ui._delays[id]) return smdui.ui(ui._delays[id]);
	
	var name = id;
	if (typeof id == "object"){
		if (id._settings)
			return id;
		name = (id.target||id.srcElement)||id;
	}
	return ui.views[smdui.html.locate({ target:smdui.toNode(name)},"view_id")];
};
if (smdui.isUndefined(window.$$)) window.$$=smdui.$$;

smdui.UIExtension = window.smdui_view||{};

smdui.protoUI({
	name:"baseview",
	//attribute , which will be used for ID storing
	$init:function(config){
		if (!config.id) 
			config.id = smdui.ui._uid(this.name);
		
		this._parent_cell = smdui._parent_cell;
		smdui._parent_cell = null;

		this.$scope = config.$scope || (this._parent_cell ? this._parent_cell.$scope : null);
		
		if (!this._viewobj){
			this._contentobj = this._viewobj = smdui.html.create("DIV",{
				"class":"smdui_view"
			});
			this.$view = this._viewobj;
		}
	},
	$skin:false,
	defaults:{
		width:0,
		height:0,
		gravity:1
	},
	getNode:function(){
		return this._viewobj;
	},
	getParentView:function(){
		return this._parent_cell||null;	
	},
	getTopParentView:function(){
		var parent = this.getParentView();
		return parent ? parent.getTopParentView() :  this;
	},
	getFormView:function(){
		var parent = this.getParentView();
		return (!parent || parent.setValues) ? parent : parent.getFormView();
	},
	getChildViews:function(){ return []; },
	isVisible:function(base_id, prev_id){
		if (this._settings.hidden){
            if(base_id){
                if (!this._hidden_render) {
                    this._hidden_render = [];
                    this._hidden_hash = {};
                }
                if (!this._hidden_hash[base_id]){
                    this._hidden_hash[base_id] =  true;
                    this._hidden_render.push(base_id);
                }
            }
			return false;
		}
		
		var parent = this.getParentView();
		if (parent) return parent.isVisible(base_id, this._settings.id);
		
		return true;
	},
	isEnabled:function(){
		if(this._disable_cover)
			return false;

		var parent= this.getParentView();
		if(parent)
			return parent.isEnabled();

		return true;
	},
	disable:function(){
		smdui.html.remove(this._disable_cover);
		this._settings.disabled = true;

		this._disable_cover = smdui.html.create('div',{
			"class":"smdui_disabled"
		});

		if(window.getComputedStyle)
			this._disabled_view_pos = window.getComputedStyle(this._viewobj, null).getPropertyValue("position");
		
		if (this._disabled_view_pos != "absolute")
			this._viewobj.style.position = "relative";
		this._viewobj.appendChild(this._disable_cover);
		this._viewobj.setAttribute("aria-disabled", "true");
		smdui.html.addCss(this._viewobj,"smdui_disabled_view",true);
		smdui.UIManager._moveChildFocus(this);
	},
	enable:function(){
		this._settings.disabled = false;

		if (this._disable_cover){
			smdui.html.remove(this._disable_cover);
			smdui.html.removeCss(this._viewobj,"smdui_disabled_view");
			this._viewobj.removeAttribute("aria-disabled");
			this._disable_cover = null;
			if(this._disabled_view_pos)
				this._viewobj.style.position = this._disabled_view_pos;
		}
	},
	disabled_setter:function(value){
		if (value)
			this.disable();
		else
			this.enable();
		return value;
	},
	container_setter:function(value){
		smdui.assert(smdui.toNode(value),"Invalid container");
		return true;
	},
	css_setter:function(value){
		if (typeof value == "object")
			value = smdui.html.createCss(value);

		this._viewobj.className += " "+value;
		return value;
	},
	id_setter:function(value){
		if (smdui._global_collection && (smdui._global_collection != this || this._prev_global_col)){
			var oldvalue = this.config.$id = value;
			(this._prev_global_col || smdui._global_collection)._elements[value] = this;
			value = smdui.ui._uid(this.name);
			(this._prev_global_col || smdui._global_collection)._translate_ids[value]=oldvalue;
		}
		smdui.assert(!smdui.ui.views[value], "Non unique view id: "+value);
		smdui.ui.views[value] = this;
		this._viewobj.setAttribute("view_id", value);
		return value;
	},
	$setSize:function(x,y){
		var last = this._last_size;
		if (last && last[0]==x && last[1]==y) {
			smdui.debug_size_box(this, [x,y,"not changed"]);
			return false;
		}

		smdui.debug_size_box(this, [x,y]);
		
		this._last_size = [x,y];
		this.$width  = this._content_width = x-(this._scroll_y?smdui.ui.scrollSize:0);
		this.$height = this._content_height = y-(this._scroll_x?smdui.ui.scrollSize:0);

		var config = this._settings;
		if (!config.flex){
			this._viewobj.style.width = x+"px";
			this._viewobj.style.height = y+"px";
		}

		return true;
	},
	$getSize:function(dx, dy){
		var s = this._settings;

		var size = [
			(s.width || s.minWidth || 0)*1,
			(s.width || s.maxWidth || 100000)*1,
			(s.height || s.minHeight || 0)*1,
			(s.height || s.maxHeight || 100000)*1,
			s.gravity
		];

		if (smdui.assert){
			var check = (isNaN(size[0]) || isNaN(size[1]) || isNaN(size[2]) || isNaN(size[3]));
			if (check){
				smdui.assert(false, "Size is not a number "+this._settings.id);
				s.width = s.height = s.maxWidth = s.maxHeight = s.minWidth = s.minHeight = 0;
				size = [0,0,100000,100000,1];
			}
		}

		size[0]+=dx; size[1]+=dx;
		size[2]+=dy; size[3]+=dy;
		return size;
	},
	show:function(force, animate_settings){
		var parent = this.getParentView();
        var show = !arguments[2];
		if (parent) {
			if(!animate_settings && animate_settings !== false && this._settings.animate)
				if (parent._settings.animate)
					animate_settings = smdui.extend((parent._settings.animate?smdui.extend({},parent._settings.animate):{}), this._settings.animate, true);

			if (show?parent._show:parent._hide)
				(show?parent._show:parent._hide).call(parent, this, animate_settings);
			if (show)
				this._render_hidden_views();

			//force show of parent view
			//stop further processing is view is a part of isolated scope
			if (force && show)  
				parent.show(parent.$$?false:force);
		}
        else{
            if (this._settings.hidden){
            	if (show){
            		var node = smdui.toNode(this._settings._container||document.body);
        			node.appendChild(this._viewobj);
        			this._settings.hidden = false;

        			this.adjust();
        			this._render_hidden_views();
            	}
            } else {
            	if (!show){
            		this._settings.hidden = this._settings._hidden = true;
            		if (this._viewobj){
            			this._settings._container = this._viewobj.parentNode;
        				smdui.html.remove(this._viewobj);
        			}
            	}
            }
        }
	},
	_render_hidden_views:function(){
		if (this._hidden_render){
			for (var i=0; i < this._hidden_render.length; i++){
				var ui_to_render = smdui.$$(this._hidden_render[i]);
				if (ui_to_render)
					ui_to_render.render();
			}
			this._hidden_render = [];
			this._hidden_hash = {};
		}
	},
	_onKeyPress:function(code, e){
		var target = e.srcElement || e.target, role = target.getAttribute("role");

		if((code === 13 || code === 32) && role == "button" && !this._settings.disabled){
			smdui.html.triggerEvent(target, "MouseEvents", "click");
			smdui.html.preventEvent(e);
		}
	},
	hidden_setter:function(value){
		if (value) this.hide();
		return this._settings.hidden;
	},
	hide:function(){
		this.show(null, null, true);
		smdui.UIManager._moveChildFocus(this);
	},
	adjust:function(){
		if(!this._viewobj.parentNode)
			return false;

		var x = this._viewobj.parentNode.clientWidth||0;
		var y = this._viewobj.parentNode.clientHeight||0;

		var sizes=this.$getSize(0,0);
		var fullscreen = (this._viewobj.parentNode == document.body) && !this.setPosition;

		//minWidth
		if (sizes[0]>x) x = sizes[0];
		//minHeight
		if (sizes[2]>y) y = sizes[2];

		//maxWidth rule
		if ((!fullscreen || this._settings.width)  && x>sizes[1]) x = sizes[1];
		//maxHeight rule
		if ((!fullscreen || this._settings.height) && y>sizes[3]) y = sizes[3];

		this.$setSize(x,y);
		if (smdui._responsive_exception){
			smdui._responsive_exception = false;
			this.adjust();
		}
	},
	resize:function(force){
		if (smdui._child_sizing_active || smdui.ui.$freeze || smdui._responsive_tinkery ) return;

		var parent = this.getParentView();
		if (parent){
			if (parent.resizeChildren)
				parent.resizeChildren();
			else
				parent.resize();
		} else {
			this.adjust();
			smdui.callEvent("onResize",[]);
		}
	}
}, smdui.Settings, smdui.Destruction, smdui.BaseBind, smdui.UIExtension);

/*
	don't render borders itself , but aware of layout , which can set some borders
*/
smdui.protoUI({
	name:"view",
	$init:function(config){
		this._set_inner(config);
	},

	//deside, will component use borders or not
	_set_inner:function(config){
		var border_not_set = smdui.isUndefined(config.borderless);
		if (border_not_set && !this.setPosition && config.$topView){
			config.borderless = true;
			border_not_set = false;
		}

		if ((border_not_set && this.defaults.borderless) || config.borderless){
			//button and custom borderless
			config._inner = { top:true, left:true, bottom:true, right:true };
		} else {
			//default borders
			if (!config._inner)
				config._inner = {};
			this._contentobj.style.borderWidth="1px";
		}
	},

	$getSize:function(dx, dy){

		var _borders = this._settings._inner;
		if (_borders){
			dx += (_borders.left?0:1)+(_borders.right?0:1);
			dy += (_borders.top?0:1)+(_borders.bottom?0:1);
		}
		
		var size = smdui.ui.baseview.prototype.$getSize.call(this, dx, dy);
		
		smdui.debug_size_box(this, size, true);
		return size;
	},
	$setSize:function(x,y){
		smdui.debug_size_box(this, [x,y]);
			
		var _borders = this._settings._inner;
		if (_borders){
			x -= (_borders.left?0:1)+(_borders.right?0:1);
			y -= (_borders.top?0:1)+(_borders.bottom?0:1);
		}
			
		return smdui.ui.baseview.prototype.$setSize.call(this,x,y);
	}
}, smdui.ui.baseview);

})();

smdui.ui.view.call(smdui);

smdui.debug_size_indent = 0;
smdui.debug_size_step = function(){
	var str = "";
	for (var i=0; i<smdui.debug_size_indent; i++)
		str+="|  ";
	return str;
};
smdui.debug_size_box_start = function(comp, get){
	if (!smdui.debug_size) return;
	if (!smdui.debug_size_indent)
		smdui.log(get?"--- get sizes ---":"--- set sizes ---");
	smdui.log(smdui.debug_size_step()+comp.name+"@"+comp.config.id);
	smdui.debug_size_indent++;
};
smdui.debug_size_box_end = function(comp, sizes){
	if (!smdui.debug_size) return;
	smdui.debug_size_indent--;
	smdui.log(smdui.debug_size_step()+sizes.join(","));
};

smdui.debug_size_box = function(comp, sizes, get){
	if (!smdui.debug_size) return;
	if (!smdui.debug_size_indent)
		smdui.log(get?"--- get sizes ---":"--- set sizes ---");
	smdui.log(smdui.debug_size_step()+comp.name+"@"+comp.config.id+" "+sizes.join(","));
};

smdui.protoUI({
	name:"spacer",
	defaults:{
		borderless:true
	},
	$init:function(){
		this._viewobj.className += " smdui_spacer";
	}
}, smdui.ui.view);

smdui.protoUI({
	name:"baselayout",
	$init:function(config){
		this.$ready.push(this._parse_cells);
		this._dataobj  = this._contentobj;
		this._layout_sizes = [];
		this._responsive = [];

		if (config.$topView){
			config.borderless = true;
			config._inner = { top:true, left:true, bottom:true, right:true };
		}

		if (config.isolate)
			smdui.extend(this, smdui.IdSpace);
	},
	rows_setter:function(value){
		this._vertical_orientation = 1;
		this._collection = value;
	},
	cols_setter:function(value){
		this._vertical_orientation = 0;
		this.$view.style.whiteSpace = "nowrap";
		this._collection = value;
	},
	_remove:function(view){
		smdui.PowerArray.removeAt.call(this._cells, smdui.PowerArray.find.call(this._cells, view));
		this.resizeChildren(true);
	},
	_replace:function(new_view,target_id){
		if (smdui.isUndefined(target_id)){
			for (var i=0; i < this._cells.length; i++)
				this._cells[i].destructor();
			this._collection = new_view;
			this._parse_cells();
		} else {
			var source;
			if (typeof target_id == "number"){
				if (target_id<0 || target_id > this._cells.length)
					target_id = this._cells.length;
				var prev_node = (this._cells[target_id]||{})._viewobj;
				smdui.PowerArray.insertAt.call(this._cells, new_view, target_id);
				if (!new_view._settings.hidden)
					smdui.html.insertBefore(new_view._viewobj, prev_node, this._dataobj);
			} else {
				source = smdui.$$(target_id);
				target_id = smdui.PowerArray.find.call(this._cells, source);
				smdui.assert(target_id!=-1, "Attempt to replace the non-existing view");
				var parent = source._viewobj.parentNode;
				if (parent && !new_view._settings.hidden)
					parent.insertBefore(new_view._viewobj, source._viewobj);

				source.destructor();	
				this._cells[target_id] = new_view;
			}

			if (!this._vertical_orientation)
				this._fix_vertical_layout(new_view);
			
			this._cells[target_id]._parent_cell = this;
		}
		this.resizeChildren(true);

		var form = this.elements ? this : this.getFormView();
		if (form) form._recollect_elements();

		smdui.callEvent("onReconstruct",[this]);
	},
	_fix_vertical_layout:function(cell){
		cell._viewobj.style.display = "inline-block";
		cell._viewobj.style.verticalAlign = "top";
	},
	addView:function(view, index){
		if (smdui.isUndefined(index))
			index = this._cells.length;
		var top = this.$$ ? this : this.getTopParentView();
		top = (top && top.ui) ? top : smdui;
		return top.ui(view, this, index)._settings.id;
	},
	removeView:function(id){
		var view;
		if (typeof id != "object")
			view = smdui.$$(id) || (this.$$ ? this.$$(id) : null);
		else
			view = id;

		var target = smdui.PowerArray.find.call(this._cells, view);
		if (target >= 0){
			if (this._beforeRemoveView)
				this._beforeRemoveView(target, view);

			var form = this.elements ? this : this.getFormView();

			this._cells.splice(target, 1);
			if (form)
				smdui.ui.each(view, function(sub){
					if (sub.name)
						delete form.getCleanValues()[sub.config.name];
				}, form, true);				

			view.destructor();
			this.resizeChildren(true);
			
			if (form)
				form._recollect_elements();
		} else
			smdui.assert(false, "Attemp to remove not existing view: "+id);

		smdui.callEvent("onReconstruct",[this]);
	},
	reconstruct:function(){
		this._hiddencells = 0;
		this._replace(this._collection);
	},
	_hide:function(obj, settings, silent){
		if (obj._settings.hidden) return;
		obj._settings.hidden = true;
		smdui.html.remove(obj._viewobj);
        this._hiddencells++;
		if (!silent && !smdui._ui_creation)
			this.resizeChildren(true);	
	},
	_signal_hidden_cells:function(view){
		if (view.callEvent)
			view.callEvent("onViewShow",[]);
	},
	resizeChildren:function(){
		if (smdui.ui.$freeze) return;

		if (this._layout_sizes){
			var parent = this.getParentView();
			if (parent){
				if (parent.resizeChildren)
					return parent.resizeChildren();
				else
					return parent.resize();
			}
				
			var sizes = this.$getSize(0,0);

			var x,y,nx,ny;
			nx = x = this._layout_sizes[0] || 0;
			ny = y = this._layout_sizes[1] || 0;

			//for auto-fill content, use adjust strategy
			if ((sizes[1]>=100000 || sizes[3] >= 100000) && this._viewobj.parentNode){
				//in hidden container adjust doesn't work, so fallback to last known size
				//also, ensure that min-size is not violated
				nx = x = Math.max(sizes[0], (this._settings.width || this._viewobj.parentNode.offsetWidth || x || 0));
				ny = y = Math.max(sizes[2], (this._settings.height || this._viewobj.parentNode.offsetHeight || y || 0));
			}
			
			if (!parent){
				//minWidth
				if (sizes[0]>x) nx = sizes[0];
				//minHeight
				if (sizes[2]>y) ny = sizes[2];

				//maxWidth rule
				if (x>sizes[1]) nx = sizes[1];
				//maxHeight rule
				if (y>sizes[3]) ny = sizes[3];

				this.$setSize(nx,ny);
			} else
				this._set_child_size(x,y);

			if (smdui._responsive_exception){
				smdui._responsive_exception = false;
				this.resizeChildren();
			}

			smdui.callEvent("onResize",[]);
		}
	},
	getChildViews:function(){
		return this._cells;
	},
	index:function(obj){
		if (obj._settings)
			obj = obj._settings.id;
		for (var i=0; i < this._cells.length; i++)
			if (this._cells[i]._settings.id == obj)
				return i;
		return -1;
	},
	_show:function(obj, settings, silent){

		if (!obj._settings.hidden) return;
		obj._settings.hidden = false;

        //index of sibling cell, next to which new item will appear
        var index = this.index(obj)+1;
        //locate nearest visible cell
        while (this._cells[index] && this._cells[index]._settings.hidden) index++;
        var view = this._cells[index] ? this._cells[index]._viewobj : null;

        smdui.html.insertBefore(obj._viewobj, view, (this._dataobj||this._viewobj));
        this._hiddencells--;

        if (!silent){
            this.resizeChildren(true);
            if (obj.refresh)
                obj.refresh();
        }

        if (obj.callEvent){
        	obj.callEvent("onViewShow", []);
			smdui.ui.each(obj, this._signal_hidden_cells);
		}
	},
	showBatch:function(name, mode){
		var preserve = typeof mode != "undefined";
		mode = mode !== false;

		if (!preserve){
			if (this._settings.visibleBatch == name ) return;
			this._settings.visibleBatch = name;
		} else 
			this._settings.visibleBatch = "";

		var show = [];
		for (var i=0; i < this._cells.length; i++){
			if (!this._cells[i]._settings.batch) 
				show.push(this._cells[i]);
			else if (this._cells[i]._settings.batch == name){
				if (mode)
					show.push(this._cells[i]);
				else
					this._hide(this._cells[i], null, true);
			} else if (!preserve)
				this._hide(this._cells[i], null, true);
		}

		for (var i=0; i < show.length; i++){
			this._show(show[i], null, true);
			show[i]._render_hidden_views();
		}
			
		this.resizeChildren(true);
	},
	_parse_cells:function(collection){
		this._cells=[];

		smdui.assert(collection,this.name+" was incorrectly defined. <br><br> You have missed rows|cols|cells|elements collection"); 
		for (var i=0; i<collection.length; i++){
			smdui._parent_cell = this;
			if (!collection[i]._inner)
				collection[i].borderless = true;

			this._cells[i]=smdui.ui._view(collection[i], this);
			if (!this._vertical_orientation)
				this._fix_vertical_layout(this._cells[i]);
			
			if (this._settings.visibleBatch && this._settings.visibleBatch != this._cells[i]._settings.batch && this._cells[i]._settings.batch){
				this._cells[i]._settings.hidden = true;
				this._hiddencells++;
			}
			
			if (!this._cells[i]._settings.hidden){
				(this._dataobj||this._contentobj).appendChild(this._cells[i]._viewobj);
				if (this._cells[i].$nospace)
					this._hiddencells++;
			}
		}

		if (this._parse_cells_ext_end)
			this._parse_cells_ext_end(collection);	
	},
	_bubble_size:function(prop, size, vertical){
		if (this._vertical_orientation != vertical)
			for (var i=0; i<this._cells.length; i++){
				this._cells[i]._settings[prop] = size;
				if (this._cells[i]._bubble_size)
					this._cells[i]._bubble_size(prop, size, vertical);
			}
	},
	$getSize:function(dx, dy){
		smdui.debug_size_box_start(this, true);
		var minWidth = 0; 
		var maxWidth = 100000;
		var maxHeight = 100000;
		var minHeight = 0;
		if (this._vertical_orientation) maxHeight=0; else maxWidth = 0;
		
		var fixed = 0;
		var fixed_count = 0;
		var gravity = 0;
		this._sizes=[];

		for (var i=0; i < this._cells.length; i++) {
			//ignore hidden cells
			if (this._cells[i]._settings.hidden)
				continue;
			
			var sizes = this._sizes[i] = this._cells[i].$getSize(0,0);

			if (this._cells[i].$nospace){
 				fixed_count++;
 				continue;
 			}

			if (this._vertical_orientation){
				//take max minSize value
				if (sizes[0]>minWidth) minWidth = sizes[0];
				//take min maxSize value
				if (sizes[1]<maxWidth) maxWidth = sizes[1];
				
				minHeight += sizes[2];
				maxHeight += sizes[3];

				if (sizes[2] == sizes[3] && sizes[2] != -1){ fixed+=sizes[2]; fixed_count++; }
				else gravity += sizes[4];
			} else {
				//take max minSize value
				if (sizes[2]>minHeight) minHeight = sizes[2];
				//take min maxSize value
				if (sizes[3]<maxHeight) maxHeight = sizes[3];
				
				minWidth += sizes[0];
				maxWidth += sizes[1];

				if (sizes[0] == sizes[1] && sizes[0] != -1){ fixed+=sizes[0]; fixed_count++; }
				else gravity += sizes[4];
			}
		}

		if (minHeight>maxHeight)
			maxHeight = minHeight;
		if (minWidth>maxWidth)
			maxWidth = minWidth;

		this._master_size = [fixed, this._cells.length - fixed_count, gravity];
		this._desired_size = [minWidth+dx, minHeight+dy];

		//get layout sizes
		var self_size = smdui.ui.baseview.prototype.$getSize.call(this, 0, 0);
		//use child settings if layout's one was not defined
		if (self_size[1] >= 100000) self_size[1]=0;
		if (self_size[3] >= 100000) self_size[3]=0;

		self_size[0] = (self_size[0] || minWidth ) +dx;
		self_size[1] = Math.max(self_size[0], (self_size[1] || maxWidth ) +dx);
		self_size[2] = (self_size[2] || minHeight) +dy;
		self_size[3] = Math.max(self_size[2], (self_size[3] || maxHeight) +dy);

		smdui.debug_size_box_end(this, self_size);

		if (!this._vertical_orientation && this._settings.responsive)
			self_size[0] = 0;

		return self_size;
	},
	$setSize:function(x,y){
		this._layout_sizes = [x,y];
		smdui.debug_size_box_start(this);

		smdui.ui.baseview.prototype.$setSize.call(this,x,y);
		this._set_child_size(x,y);

		smdui.debug_size_box_end(this, [x,y]);
	},
	_set_child_size_a:function(sizes, min, max){
		min = sizes[min]; max = sizes[max];
		var height = min;

		if (min != max){
			var ps = this._set_size_delta * sizes[4]/this._set_size_gravity;
			if (ps < min){
				height = min;
				this._set_size_gravity -= sizes[4]; 
				this._set_size_delta -= height;
			} else  if (ps > max){
				height = max;
				this._set_size_gravity -= sizes[4]; 
				this._set_size_delta -= height;
			} else {
				return -1;
			}
		}

		return height;
	},
	_responsive_hide:function(cell, mode){
		var target =  smdui.$$(mode);

		if (target === "hide" || !target){
			cell.hide();
			cell._responsive_marker = "hide";
		} else{
			//for SideBar in smdui 1.9
			if (!target)
				target = smdui.ui({ view:"popup", body:[{}]});

			cell._responsive_width = cell._settings.width;
			cell._responsive_height = cell._settings.height;
			cell._responsive_marker = target._settings.id;
			cell._settings.width = 0;
			if (!cell._settings.height)
				cell._settings.autoheight = true;

			smdui.ui(cell, target, this._responsive.length);
		}

		this._responsive.push(cell);
	},
	_responsive_show:function(cell){
		var target = cell._responsive_marker;
		cell._responsive_marker = 0;

		if (target === "hide" || !target){
			cell.show();
		} else {
			cell._settings.width = cell._responsive_width;
			cell._settings.height = cell._responsive_height;
			delete cell._settings.autoheight;

			var index = 0;
			while (this._cells[index] && this._cells[index]._settings.responsiveCell === false) index++;
			smdui.ui(cell, this, index);
		}
		this._responsive.pop();
	},
	_responsive_cells:function(x,y){
		smdui._responsive_tinkery = true;
		if (x + this._paddingX*2 + this._margin * (this._cells.length-1)< this._desired_size[0]){
			var max = this._cells.length - 1;
			for (var i = 0; i < max; i++){
				var cell = this._cells[i];
				if (!cell._responsive_marker){
					if (cell._settings.responsiveCell !== false){
						this._responsive_hide(cell, this._settings.responsive);
						smdui.callEvent("onResponsiveHide", [cell._settings.id]);
						smdui._responsive_exception = true;
						break;
					} else {
						max = this._cells.length;
					}
				}
			}
		} else  if (this._responsive.length){
			var cell = this._responsive[this._responsive.length-1];
			var dx = cell._responsive_marker == "hide" ? 0 : cell._responsive_width;
			var px = cell.$getSize(dx,0);
			if (px[0] + this._desired_size[0] + this._margin + 20 <= x ){
				this._responsive_show(cell);
				smdui.callEvent("onResponsiveShow", [cell._settings.id]);
				smdui._responsive_exception = true;
			}
		}

		smdui._responsive_tinkery = false;
	},
	_set_child_size:function(x,y){ 
		smdui._child_sizing_active = (smdui._child_sizing_active||0)+1;

		if (!this._vertical_orientation && this._settings.responsive)
			this._responsive_cells(x,y);


		this._set_size_delta = (this._vertical_orientation?y:x) - this._master_size[0];
		this._set_size_gravity = this._master_size[2];
		var width = x; var height = y;

		var auto = [];
		for (var i=0; i < this._cells.length; i++){
			//ignore hidden cells
			if (this._cells[i]._settings.hidden || !this._sizes[i])
				continue;

			var sizes = this._sizes[i];

			if (this._vertical_orientation){
				var height = this._set_child_size_a(sizes,2,3);
				if (height < 0)	{ auto.push(i); continue; }
			} else {
				var width = this._set_child_size_a(sizes,0,1);
				if (width < 0)	{ auto.push(i); continue; }
			}
			this._cells[i].$setSize(width,height);
		}

		for (var i = 0; i < auto.length; i++){
			var index = auto[i];
			var sizes = this._sizes[index];
			var dx = Math.round(this._set_size_delta * sizes[4]/this._set_size_gravity);
			this._set_size_delta -= dx; this._set_size_gravity -= sizes[4];
			if (this._vertical_orientation)
				height = dx;
			else {
				width = dx;
			}

			this._cells[index].$setSize(width,height);
		}

		smdui._child_sizing_active -= 1;
	},
	_next:function(obj, mode){
		var index = this.index(obj);
		if (index == -1) return null;
		return this._cells[index+mode];
	}, 
	_first:function(){
		return this._cells[0];
	}
}, smdui.EventSystem, smdui.ui.baseview);

smdui.protoUI({
	name:"layout",
	$init:function(config){
		this._hiddencells = 0;
	},
	defaults:{
		type:"line"
	},
	_parse_cells:function(){
		if (this._parse_cells_ext)
			collection = this._parse_cells_ext(collection);

		if (!this._parse_once){
			this._viewobj.className += " smdui_layout_"+(this._settings.type||"");
			this._parse_once = 1;
		}

		if (this._settings.margin !== smdui.undefined)
			this._margin = this._settings.margin;

		if (this._settings.padding != smdui.undefined)
			this._paddingX = this._paddingY = this._settings.padding;
		if (this._settings.paddingX !== smdui.undefined)
			this._paddingX = this._settings.paddingX;
		if (this._settings.paddingY !== smdui.undefined)
			this._paddingY = this._settings.paddingY;

		if (this._paddingY || this._paddingX)
			this._padding = true;

		//if layout has paddings we need to set the visible border 
		if (this._hasBorders() && !this._settings.borderless){
		 	this._contentobj.style.borderWidth="1px";
			//if layout has border - normal bordering rules are applied
			this._render_borders = true;
		}
	
		
		var collection = this._collection;
	
		if (this._settings.borderless)
			this._settings._inner = { top:true, left:true, right:true, bottom:true};

		this._beforeResetBorders(collection);
		smdui.ui.baselayout.prototype._parse_cells.call(this, collection);
		this._afterResetBorders(collection);
	},
	$getSize:function(dx, dy){
		dx=dx||0; dy=dy||0;

		var correction = this._margin*(this._cells.length-this._hiddencells-1);
		if (this._render_borders || this._hasBorders()){
			var _borders = this._settings._inner;
			if (_borders){
				dx += (_borders.left?0:1)+(_borders.right?0:1);
				dy += (_borders.top?0:1)+(_borders.bottom?0:1);
			}
		}

		if (!this._settings.height)
			dy += (this._paddingY||0)*2 + (this._vertical_orientation ? correction : 0);

		if (!this._settings.width)
			dx += (this._paddingX||0)*2 + (this._vertical_orientation ? 0 : correction);
				
		return smdui.ui.baselayout.prototype.$getSize.call(this, dx, dy);
	},
	$setSize:function(x,y){
		this._layout_sizes = [x,y];
		smdui.debug_size_box_start(this);

		var result;
		if (this._hasBorders()||this._render_borders)
			result = smdui.ui.view.prototype.$setSize.call(this,x,y);
		else	
			result = smdui.ui.baseview.prototype.$setSize.call(this,x,y);

		//form with scroll
		y = this._content_height;
		x = this._content_width;

		var config = this._settings;
		if (config.scroll){
			y = Math.max(y, this._desired_size[1]);
			x = Math.max(x, this._desired_size[0]);
		}
		
		this._set_child_size(x, y);

		smdui.debug_size_box_end(this, [x,y]);
	},
	_set_child_size:function(x,y){
		var correction = this._margin*(this._cells.length-this._hiddencells-1);

		if (this._vertical_orientation){
			y-=correction+this._paddingY*2;
			x-=this._paddingX*2;
		}
		else {
			x-=correction+this._paddingX*2;
			y-=this._paddingY*2;
		}
		return smdui.ui.baselayout.prototype._set_child_size.call(this, x, y);
	},
	resizeChildren:function(structure_changed){ 
		if (structure_changed){
			this._last_size = null; //forces children resize
			var config = [];
			for (var i = 0; i < this._cells.length; i++){
				var cell = this._cells[i];
				config[i] = cell._settings;
				var n = ((cell._layout_sizes && !cell._render_borders) || cell._settings.borderless)?"0px":"1px";

				cell._viewobj.style.borderTopWidth=cell._viewobj.style.borderBottomWidth=cell._viewobj.style.borderLeftWidth=cell._viewobj.style.borderRightWidth=n;
			}
			
			this._beforeResetBorders(config);
			for (var i=0; i<config.length; i++)
				if (config[i].borderless && this._cells[i]._set_inner)
					this._cells[i]._set_inner(config[i]);
			this._afterResetBorders(this._cells);
		}

		if (smdui._responsive_tinkery) return;
		smdui.ui.baselayout.prototype.resizeChildren.call(this);
	},
	_hasBorders:function(){
		return this._padding && this._margin>0 && !this._cleanlayout;
	},
	_beforeResetBorders:function(collection){
		if (this._hasBorders() && (!this._settings.borderless || this._settings.type == "space")){
			for (var i=0; i < collection.length; i++){
				if (!collection[i]._inner || !collection[i].borderless)
					collection[i]._inner={ top:false, left:false, right:false, bottom:false};
			}
		} else {
			for (var i=0; i < collection.length; i++)
				collection[i]._inner=smdui.clone(this._settings._inner);
			var mode = false;
			if (this._cleanlayout)
				mode = true;
				
			var maxlength = collection.length;				
			if (this._vertical_orientation){
				for (var i=1; i < maxlength-1; i++)
					collection[i]._inner.top = collection[i]._inner.bottom = mode;
				if (maxlength>1){
					if (this._settings.type!="head")
						collection[0]._inner.bottom = mode;

					while (collection[maxlength-1].hidden && maxlength>1)
						maxlength--;
					if (maxlength>0)
						collection[maxlength-1]._inner.top = mode;
				}
			}
			else {
				for (var i=1; i < maxlength-1; i++)
					collection[i]._inner.left = collection[i]._inner.right= mode;
				if (maxlength>1){
					if (this._settings.type!="head")
						collection[0]._inner.right= mode;
					collection[maxlength-1]._inner.left = mode;

					while (maxlength>1 && collection[maxlength-1].hidden)
						maxlength--;
					if (maxlength>0)
						collection[maxlength-1]._inner.left = mode;
				}
			}

		}
	},
	_fix_container_borders:function(style, inner){
		if (inner.top) 
			style.borderTopWidth="0px";
		if (inner.left) 
			style.borderLeftWidth="0px";
		if (inner.right) 
			style.borderRightWidth="0px";
		if (inner.bottom) 
			style.borderBottomWidth="0px";
	},
	_afterResetBorders:function(collection){
		var start = 0; 
		for (var i=0; i<collection.length; i++){
			var cell = this._cells[i];

			var s_inner = cell._settings._inner;
			if (cell._settings.hidden && this._cells[i+1]){
				var s_next = this._cells[i+1]._settings._inner;
				if (!s_inner.top)
					s_next.top = false;
				if (!s_inner.left)
					s_next.left = false;

				if (i==start) start++;
			}
			this._fix_container_borders(cell._viewobj.style, cell._settings._inner);
		}

		var style = this._vertical_orientation?"marginLeft":"marginTop";
		var contrstyle = this._vertical_orientation?"marginTop":"marginLeft";
		var padding = this._vertical_orientation?this._paddingX:this._paddingY;
		var contrpadding = this._vertical_orientation?this._paddingY:this._paddingX;

		//add top offset to all
		for (var i=0; i<collection.length; i++)
			this._cells[i]._viewobj.style[style] = (padding||0) + "px";			

		//add left offset to first cell
		if (this._cells.length)
			this._cells[start]._viewobj.style[contrstyle] = (contrpadding||0)+"px";

		//add offset between cells
		for (var index=start+1; index<collection.length; index++)
			this._cells[index]._viewobj.style[contrstyle]=this._margin+"px";
		
	},
	type_setter:function(value){
		this._margin = (typeof this._margin_set[value] != "undefined"? this._margin_set[value]: this._margin_set["line"]);
		this._paddingX = this._paddingY = (typeof this._margin_set[value] != "undefined"? this._padding_set[value]: this._padding_set["line"]);
		this._cleanlayout = (value=="material" || value=="clean");
		if (value == "material")
			this._settings.borderless = true;

		return value;
	},
	$skin:function(){
		var skin = smdui.skin.$active;
		this._margin_set = skin.layoutMargin;
		this._padding_set = skin.layoutPadding;
	}
}, smdui.ui.baselayout);

smdui.ui.layout.call(smdui);

smdui.FlexLayout = {
	$init:function(){
		this.$view.className += " smdui_flexlayout";
	},
	_fix_vertical_layout:function(){

	},
	_beforeResetBorders:function(){

	},
	_afterResetBorders:function(){

	},
	$getSize:function(dx, dy){
		smdui.debug_size_box_start(this, true);
		
		var w=0, h=0, g = this._settings.gravity;
		this._sizes = [];

		for (var i=0; i<this._cells.length; i++){
			var size = this._cells[i].$getSize(0,0);
			this._sizes.push(size);

			w = Math.max(w, size[0]);
			h = Math.max(h, size[2]);
		}

		w += (this._paddingX||0)*2;
		h += (this._paddingY||0)*2;

		if (this._settings.width)
			w = Math.max(w, this._settings.width);
		if (this._settings.height)
			h = Math.max(h, this._settings.height);

		var self_size = [w, 100000, h, 100000, g];
		smdui.debug_size_box_end(this, self_size);
		return self_size;
	},
	_set_child_size:function(x,y){
		var st = this.$view.style;
		var margin = Math.round(this._margin/2);
		st.paddingTop = st.paddingBottom = this._paddingY-margin + "px";
		st.paddingLeft = st.paddingRight = this._paddingX-margin + "px";

		for (var i=0; i<this._cells.length; i++){
			if (this._cells[i]._settings.hidden) continue;
			var view = this._cells[i].$view;
			var size = this._sizes[i];
			var config = this._cells[i]._settings;

			if (view){
				view.style.minWidth = size[0]+"px";
				if (size[1] < 100000 && size[1] != size[0])
					view.style.maxWidth = size[1]+"px";

				view.style.flexBasis = config.flexBasis || (size[0])+"px";
				view.style.flexGrow = config.flexGrow || ((size[1] != size[0]) ? size[4] : 0);
				view.style.height = (size[3] != size[2]) ? "auto" : (size[2] + "px");

				view.style.minHeight = size[2]+"px";
				if (size[3] < 100000 && size[3] != size[2])
					view.style.maxHeight = size[3]+"px";

				view.style.margin = margin + "px";
			}
		}

		var whs = [];
		for (var i=0; i<this._cells.length; i++){
			if (this._cells[i]._settings.hidden) continue;
			var view = this._cells[i].$view;
			whs[i] = [view.offsetWidth, view.offsetHeight];
		}
		
		for (var i=0; i<this._cells.length; i++){
			if (this._cells[i]._settings.hidden) continue;
			var cell = this._cells[i];
			var view = cell.$view;
			if (view){
				cell._settings.flex = true;
				var size = this._sizes[i];
				var h = size[2] == size[3] ? size[2] : whs[i][1];
				cell.$setSize(whs[i][0], h);
				cell._settings.flex = false;
			}
		}

		this.$height = this._content_height = this.$view.scrollHeight;
		this.$view.style.height = this._content_height+"px";
	}
};
smdui.protoUI({
	$init:function(){
		smdui.extend(this, smdui.FlexLayout, true);
	},
	name:"flexlayout"
}, smdui.ui.layout);

smdui.protoUI({
	name:"align",
	defaults:{
		borderless:true,
		left:0, top:0, right:0, bottom:0
	},
	$init:function(){
		this._viewobj.className	+= " smdui_view_align";
	},
	body_setter:function(value){
		value._inner = { top:false, left:false, right:false, bottom:false};
		this._body_cell = smdui.ui._view(value);
		this._body_cell._parent_cell = this;

		this._viewobj.appendChild(this._body_cell._viewobj);
		return value;
	},
	align_setter:function(value){
		if (typeof value === "string")
			value = value.split(",");

		this._x_align = this._y_align = this._p_align = "";
		for (var i=0; i<value.length; i++){
			var c = value[i];
			if (c === "center" || c === "left" || c === "right")
				this._x_align = c;
			if (c === "top" || c === "bottom" || c === "middle")
				this._y_align = c;
			if (c === "absolute")
				this._x_align = this._y_align = this._p_align = "precise";
		}

		return value;
	},
	getBody:function(){
		return this._body_cell;
	},
	$setSize:function(x,y){
		smdui.ui.view.prototype.$setSize.call(this, x,y);

		var dx, dy;
		if (this._p_align){
			dx = x - this._settings.left - this._settings.right;
			dy = y - this._settings.top - this._settings.bottom;
		} else {
			dx = this._desired_size[0] || x;
			dy = this._desired_size[2] || y;
		}



		this._body_cell.$setSize(dx, dy);

		var box = this._body_cell._viewobj;

		if (this._x_align == "center")
			box.style.marginLeft = Math.ceil((x-dx)/2)+"px";
		else if (this._x_align == "right")
			box.style.marginLeft = (x-dx)+"px";
		else
			box.style.marginLeft = (this._p_align ? this._settings.left : 0) +"px";

		if (this._y_align == "middle") 
			box.style.marginTop = Math.ceil((y-dy)/2)+"px";
		else if (this._y_align == "bottom")
			box.style.marginTop = (y-dy)+"px";
		else
			box.style.marginTop = (this._p_align ? this._settings.top : 0) + "px";
	},
	$getSize:function(dx,dy){
		var size = this._desired_size = this._body_cell.$getSize(0,0);
		var self_size = smdui.ui.baseview.prototype.$getSize.call(this, 0, 0);
	
		if (this._p_align){
			dx += this._settings.left + this._settings.right;
			dy += this._settings.top + this._settings.bottom;
		}

		if (!this._x_align || this._p_align){
			self_size[0] = size[0]+dx;
			self_size[1] = size[1]+dx;
		} else {
			self_size[0] = (self_size[0] || size[0] ) +dy;
			self_size[1] +=	dx;
		}

		if (!this._y_align || this._p_align){
			self_size[2] = size[2]+dy;
			self_size[3] = size[3]+dy;
		} else {
			self_size[2] = (self_size[2] || size[2] ) +dy;
			self_size[3] +=	dy;
		}

		return self_size;
	}
}, smdui.ui.view);

smdui.animate = function(html_element, config){
	var animation = config;
	if (smdui.isArray(html_element)){
		for (var i=0; i < html_element.length; i++) {
			if(smdui.isArray(config))
				animation = config[i];

			if(animation.type == 'slide'){
				if(animation.subtype == 'out' && i===0) { // next
				    continue;
				}
				if(animation.subtype == 'in' && i==1) { // current
				    continue;
				}
			}
			if(animation.type == 'flip'){
				var animation_copy = smdui.clone(animation);
				if(i===0) { // next
				    animation_copy.type = 'flipback';
				}
				if(i==1) { // current
				    animation_copy.callback = null;
				}
				smdui.animate(html_element[i], animation_copy);
				continue;
			}
			smdui.animate(html_element[i], animation);
		}
		return;
	}
	var node = smdui.toNode(html_element);
	if (node._has_animation)
		smdui.animate.end(node, animation);
	else
		smdui.animate.start(node, animation);
};
smdui.animate.end = function(node, animation){
	//stop animation
	node.style[smdui.env.transitionDuration] = "1ms";
	node._has_animation = null;
	//clear animation wait order, if any
	if (smdui._wait_animate)
		window.clearTimeout(smdui._wait_animate);

	//plan next animation, if any
	smdui._wait_animate = smdui.delay(smdui.animate, smdui, [node,animation],10);
};
smdui.animate.isSupported=function(){
	return !smdui.$testmode && !smdui.noanimate && smdui.env.transform && smdui.env.transition && !smdui.env.isOpera;
};
smdui.animate.formLine=function(next, current, animation){
    var direction = animation.direction;

    //sometimes user can initiate animation multiple times ( fast clicking )
    //as result animation may be called against already removed from the dom node
    if(current.parentNode)
        current.parentNode.style.position = "relative";
    
    current.style.position = "absolute";
	next.style.position = "absolute";

	//this is initial shift of second view in animation
	//normally we need to have this value as 0
	//but FF has bug with animation initially invisible elements
	//so we are adjusting this value, to make 1px of second view visible
	var defAniPos = smdui.env.isFF ? ( direction == "top" || direction == "left" ? -1 : 1) : 0;

	if(direction=="top"||direction=="bottom"){
		next.style.left="0px";
		next.style.top = (animation.top || defAniPos) + (direction=="top"?1:-1)*current.offsetHeight+"px";
	}
	else{
		next.style.top = (animation.top || 0) + "px";
		next.style.left = defAniPos + (direction=="left"?1:-1)*current.offsetWidth+"px";
	}

	// apply 'keepViews' mode, iframe solution
	//( keepViews won't work in case of "in" and "out" subtypes )
	if(current.parentNode == next.parentNode && animation.keepViews)
		next.style.display = "";
	else
		smdui.html.insertBefore(next, current.nextSibling, current.parentNode);

	if(animation.type == 'slide' && animation.subtype == 'out') {
		next.style.left = "0px";
		next.style.top = (animation.top || 0)+"px";
		current.parentNode.removeChild(current);
		smdui.html.insertBefore(current, next.nextSibling, next.parentNode);
	}
	return [next, current];
};
smdui.animate.breakLine=function(line){
	if(arguments[1])
		line[1].style.display = "none"; // 'keepViews' multiview mode
	else
		smdui.html.remove(line[1]); // 1 = current
	smdui.animate.clear(line[0]);
	smdui.animate.clear(line[1]);
	line[0].style.position="";
};
smdui.animate.clear=function(node){
	node.style[smdui.env.transform] = "none";
	node.style[smdui.env.transition] = "none";
	node.style.top = node.style.left = "";
};
smdui.animate.defaults = {
		type: 'slide',
		delay: '0',
		duration: '500',
		timing: 'ease-in-out',
		x: 0,
		y: 0
};
smdui.animate.start = function(node, animation){
	//getting config object by merging specified and default options
 	if (typeof animation == 'string')
		animation = {type: animation};

    animation = smdui.Settings._mergeSettings(animation,smdui.animate.defaults);

	var prefix = smdui.env.cssPrefix;
    var settings = node._has_animation = animation;
    var skew_options, scale_type;

    //jshint -W086:true
	switch(settings.type == 'slide' && settings.direction) { // getting new x, y in case it is slide with direction
		case 'right':
			settings.x = node.offsetWidth;
			break;
		case 'left':
			settings.x = -node.offsetWidth;
			break;
		case 'top':
			settings.y = -node.offsetHeight;
			break;
		case 'bottom':
		default:
			settings.y = settings.y||node.offsetHeight;
			break;
	}

    if(settings.type == 'flip' || settings.type == 'flipback') {
    		skew_options = [0, 0];
            scale_type = 'scaleX';
            if(settings.subtype == 'vertical') {
                skew_options[0] = 20;
                scale_type = 'scaleY';
            }
            else
                skew_options[1] = 20;
            if(settings.direction == 'right' || settings.direction == 'bottom') {
                skew_options[0] *= -1; skew_options[1] *= -1;
            }
    }

	var duration = settings.duration + "ms " + settings.timing + " " + settings.delay+"ms";
	var css_general = prefix+"TransformStyle: preserve-3d;"; // general css rules
	var css_transition = '';
	var css_transform = '';

	switch(settings.type) {
		case 'fade': // changes opacity to 0
			css_transition = "opacity " + duration;
			css_general = "opacity: 0;";
			break;
		case 'show': // changes opacity to 1
			css_transition = "opacity " + duration;
			css_general = "opacity: 1;";
			break;
        case 'flip':
            duration = (settings.duration/2) + "ms " + settings.timing + " " + settings.delay+"ms";
            css_transform = "skew("+skew_options[0]+"deg, "+skew_options[1]+"deg) "+scale_type+"(0.00001)";
            css_transition = "all "+(duration);
            break;
        case 'flipback':
            settings.delay += settings.duration/2;
            duration = (settings.duration/2) + "ms " + settings.timing + " " + settings.delay+"ms";
            node.style[smdui.env.transform] = "skew("+(-1*skew_options[0])+"deg, "+(-1*skew_options[1])+"deg) "+scale_type+"(0.00001)";
            node.style.left = "0";

            css_transform = "skew(0deg, 0deg) "+scale_type+"(1)";
            css_transition = "all "+(duration);
            break;
		case 'slide': // moves object to specified location
			var x = settings.x +"px";
			var y = settings.y +"px";
            // translate(x, y) OR translate3d(x, y, 0)
			css_transform = smdui.env.translate+"("+x+", "+y+((smdui.env.translate=="translate3d")?", 0":"")+")";
			css_transition = prefix+"transform " + duration;
			break;
		default:
			break;
	}

	//set styles only after applying transition settings
    smdui.delay(function(){
        node.style[smdui.env.transition] = css_transition;
        smdui.delay(function(){
            if (css_general)
                node.style.cssText += css_general;
            if (css_transform)
                node.style[smdui.env.transform] = css_transform;
            var transitionEnded = false;
            var tid = smdui.event(node, smdui.env.transitionEnd, function(ev){
                node._has_animation = null;
                if (settings.callback) settings.callback.call((settings.master||window), node,settings,ev);
                transitionEnded = true;
                smdui.eventRemove(tid);
            });
            window.setTimeout(function(){
                if(!transitionEnded){
                    node._has_animation = null;
                    if (settings.callback) settings.callback.call((settings.master||window), node,settings);
                    transitionEnded = true;
                    smdui.eventRemove(tid);
                }
            }, (settings.duration*1+settings.delay*1)*1.3);
        });
    });
};

/*
	Behavior:MouseEvents - provides inner evnets for  mouse actions
*/

smdui.MouseEvents={
	$init: function(config){
		config = config || {};

		this._clickstamp = 0;
		this._dbl_sensetive = 300;
		this._item_clicked = null;

		this._mouse_action_extend(config.onClick, "on_click");
		this._mouse_action_extend(config.onContext, "on_context");
		this._mouse_action_extend(config.onDblClick, "on_dblclick");
		this._mouse_action_extend(config.onMouseMove, "on_mouse_move");

		//attach dom events if related collection is defined
		if (this.on_click){
			smdui._event(this._contentobj,"click",this._onClick,{bind:this});
			if (smdui.env.isIE8 && this.on_dblclick)
				smdui._event(this._contentobj, "dblclick", this._onDblClick, {bind:this});
		}
		if (this.on_context)
			smdui._event(this._contentobj,"contextmenu",this._onContext,{bind:this});

		if (this.on_mouse_move)
			this._enable_mouse_move();
	},

	_enable_mouse_move:function(){
		if (!this._mouse_move_enabled){
			this.on_mouse_move = this.on_mouse_move || {};
			smdui._event(this._contentobj,"mousemove",this._onMouse,{bind:this});
			smdui._event(this._contentobj,(smdui.env.isIE?"mouseleave":"mouseout"),this._onMouse,{bind:this});
			this._mouse_move_enabled = 1;
			this.attachEvent("onDestruct", function(){
				if (this._mouse_move_timer)
					window.clearTimeout(this._mouse_move_timer);
			});
		}

	},

	_mouse_action_extend:function(config, key){
		if (config){
			var now = this[key];
			var step = now ? smdui.extend({}, now) : {};
			this[key] = smdui.extend(step, config);
		}
	},

	//inner onclick object handler
	_onClick: function(e){
		if(!this.isEnabled())
			return false;

		smdui.UIManager._focus_action(this);
		if(this.on_dblclick){
			// emulates double click
			var stamp = (new Date()).valueOf();

			if (stamp - this._clickstamp <= this._dbl_sensetive && this.locate){
				var item = this.locate(e);
				if (""+item == ""+this._item_clicked) {
					this._clickstamp = 0;
					return this._onDblClick(e);
				}
			}
			this._clickstamp = stamp;
		}

		var result = this._mouseEvent(e,this.on_click,"ItemClick");
		return result;
	},
	//inner ondblclick object handler
	_onDblClick: function(e) {
		return this._mouseEvent(e,this.on_dblclick,"ItemDblClick");
	},
	//process oncontextmenu events
	_onContext: function(e) {
		this._mouseEvent(e, this.on_context, "BeforeContextMenu", "AfterContextMenu");
	},
	/*
		event throttler - ignore events which occurs too fast
		during mouse moving there are a lot of event firing - we need no so much
		also, mouseout can fire when moving inside the same html container - we need to ignore such fake calls
	*/
	_onMouse:function(e){
		if (this.$destructed) return;
		if (document.createEventObject)	//make a copy of event, will be used in timed call
			e = document.createEventObject(event);
		else if (!smdui.$testmode && !smdui.isUndefined(e.movementY) && !e.movementY && !e.movementX)
			return; //logitech mouse driver can send false signals in Chrome
			
			
			
			
		if (this._mouse_move_timer)	//clear old event timer
			window.clearTimeout(this._mouse_move_timer);
				
		//this event just inform about moving operation, we don't care about details
		this.callEvent("onMouseMoving",[e]);
		//set new event timer
		this._mouse_move_timer = window.setTimeout(smdui.bind(function(){
			//called only when we have at least 100ms after previous event
			if (e.type == "mousemove")
				this._onMouseMove(e);
			else
				this._onMouseOut(e);
		},this),(this._settings.mouseEventDelay||500));
	},

	//inner mousemove object handler
	_onMouseMove: function(e) {
		if (!this._mouseEvent(e,this.on_mouse_move,"MouseMove"))
			this.callEvent("onMouseOut",[e||event]);
	},
	//inner mouseout object handler
	_onMouseOut: function(e) {
		this.callEvent("onMouseOut",[e||event]);
	},
	//common logic for click and dbl-click processing
	_mouseEvent:function(e,hash,name, pair){
		e=e||event;

		if (e.processed || !this._viewobj) return;
		e.processed = true;

		var trg=e.target||e.srcElement;

		//IE8 can't modify event object
		//so we need to stop event bubbling to prevent double processing
		if (smdui.env.isIE8){
			var vid = this._settings.id;
			var wid = trg.w_view;

			if (!wid) trg.w_view = vid; else if (wid !== vid) return;
		}

		var css = "";
		var id = null;
		var found = false;
		//loop through all parents
		//we need to check for this._viewobj as some handler can destroy the view
		while (trg && trg.parentNode && this._viewobj && trg != this._viewobj.parentNode){
			if (!found && trg.getAttribute){													//if element with ID mark is not detected yet
				id = trg.getAttribute(this._id);							//check id of current one
				if (id){
					this._item_clicked = id;
					if (this.callEvent){
						//it will be triggered only for first detected ID, in case of nested elements
						if (!this.callEvent("on"+name,[id,e,trg])) return;
						if (pair) this.callEvent("on"+pair,[id,e,trg]);
					}
					//set found flag
					found = true;
				}
			}
			css=smdui.html._getClassName(trg);
			if (css){		//check if pre-defined reaction for element's css name exists
				css = css.toString().split(" ");
				for (var i=0; i<css.length; i++){
					if (hash[css[i]]){
						var functor = smdui.toFunctor(hash[css[i]], this.$scope);
						var res =  functor.call(this,e,id||smdui.html.locate(e, this._id),trg);
						if(res === false)
							return found;
					}
				}
			}
			trg=trg.parentNode;
		}
			
		return found;	//returns true if item was located and event was triggered
	}
};

smdui.protoUI({
	name:"accordionitem",
	$init:function(config){
		this._viewobj.innerHTML = "<div smdui_ai_id='"+config.id+"'  class='smdui_accordionitem_header'><div tabindex='0' role='button' class='smdui_accordionitem_button' ></div><div class='smdui_accordionitem_label' ></div></div><div class='smdui_accordionitem_body'></div>";
		
		this._contentobj = this._viewobj;
		this._headobj = this._contentobj.childNodes[0];
		if(!config.header)
			this._headobj.style.display = "none";
		this._headlabel = this._contentobj.childNodes[0].childNodes[1];
		this._headbutton = this._contentobj.childNodes[0].childNodes[0];
		this._bodyobj = this._contentobj.childNodes[1];
		this._viewobj.className +=" smdui_accordionitem";
		this._head_cell = this._body_cell = null;
		this._cells = true;

		this._bodyobj.setAttribute("role", "tabpanel");
		this._headobj.setAttribute("role", "tab");

		this.attachEvent("onKeyPress", this._onKeyPress);
	},
	_remove:function(){
		this._body_cell = { destructor:function(){} };
	},
	_replace:function(new_view){
		this._body_cell.destructor();
		this._body_cell = new_view;
		this._body_cell._parent_cell = this;
		
		this._bodyobj.appendChild(this._body_cell._viewobj);
		this.resize();
	},
	_id:"smdui_ai_id",
	getChildViews:function(){
		return [this._body_cell];
	},
	body_setter:function(value){
		if (typeof value != "object")
			value = {template:value };

		value._inner = { top:true, left:true, right:true, bottom:true};
		this._body_cell = smdui.ui._view(value);
		this._body_cell.$view.style.border = "0px solid red";
		this._body_cell._parent_cell = this;

		this._bodyobj.appendChild(this._body_cell._viewobj);
		return value;
	},
	header_setter:function(value){
		if(value)
			value = smdui.template(value);
		return value;
	},
	headerAlt_setter:function(value){
		if(value)
			value = smdui.template(value);
		return value;
	},
	$getSize:function(dx, dy){
		var size =  this._body_cell.$getSize(0, 0);

		//apply external border to inner content sizes
		var _borders = this._settings._inner;
		if (_borders){
			dx += (_borders.left?0:1)+(_borders.right?0:1);
			dy += (_borders.top?0:1)+(_borders.bottom?0:1);
		}

		var header = 0;
		var self_size = smdui.ui.baseview.prototype.$getSize.call(this, 0, 0);

		//use child settings if layout's one was not defined
		self_size[0] = (self_size[0] || size[0] ) +dx;
		if (self_size[1] >= 100000)
			self_size[1] = size[1];
		self_size[1] +=	dx;
		
		self_size[2] = (self_size[2] || size[2] ) +dy;
		var fixedHeight = (self_size[3]< 100000);
		if (!fixedHeight)
			self_size[3] = size[3];

		self_size[3] += dy;

		if(this.getParentView()._vertical_orientation){
			if (this._settings.collapsed){
				self_size[2] = self_size[3] = this._getHeaderSize();
			} else if(this._settings.header)
				header = this._settings.headerHeight;
		} else {
			if (this._settings.collapsed)
				self_size[0] = self_size[1] = this._getHeaderSize();
			if(this._settings.header)
				header = this._settings.headerHeight;
		}

		//include header in total height calculation
		if(!fixedHeight){
			self_size[2] += header;
			self_size[3] += header;
		}

		smdui.debug_size_box(this, self_size, true);
		return self_size;
	},
	on_click:{
		smdui_accordionitem_header:function(e, id){
			this._toggle(e);
			return false;
		},
		smdui_accordionitem_header_v:function(e, id){
			this._toggle(e);
			return false;
		}
	},
	_toggle:function(e){
		this.define("collapsed", !this._settings.collapsed);
	},
	collapsed_setter:function(value){
		if (this._settings.header === false) return;
		//use last layout element if parent is not known yet
		var parent = this.getParentView();
		if(parent){
			if(!value)
				this._expand();
			else{
				if ( parent._canCollapse(this))
					this._collapse();
				else{
					var success = 0;
					if(parent._cells.length > 1)
						for (var i=0; i < parent._cells.length; i++){
							var sibl = parent._cells[i];
							if (this != sibl && sibl.isVisible() && sibl.expand){
								sibl.expand();
								this._collapse();
								success = 1;
								break;
							}
						}
					if (!success) return;
				}
			}

			this._settings.collapsed = value;
			if (!value) parent._afterOpen(this);

			this.refresh();
			if (!smdui._ui_creation)
				this.resize();

			parent.callEvent("onAfter"+(value?"Collapse":"Expand"), [this._settings.id]);

			this._settings.$noresize = value;
		}
		return value;
	},
	collapse:function(){
		this.define("collapsed", true);
		smdui.UIManager._moveChildFocus(this);
	},
	expand:function(){
		this.define("collapsed", false);
	},
	_show: function() {
		this.show();
	},
	_hide: function() {
		this.hide();
	},
	_expand:function(){
		this._bodyobj.style.display = "";
		smdui.html.removeCss(this.$view, "collapsed");
		smdui.html.removeCss(this._headobj, "collapsed");

		this._headobj.setAttribute("aria-expanded", "true");
	},
	_collapse:function(){
		var vertical = this.getParentView()._vertical_orientation;
		//this._original_size = (vertical?this._settings.height:this._settings.width)||-1;

		if(this._settings.headerAlt)
			this._headlabel.innerHTML = this._settings.headerAlt();
		this._bodyobj.style.display = "none";
		smdui.html.addCss(this.$view, "collapsed");
		smdui.html.addCss(this._headobj, "collapsed");

		this._headobj.setAttribute("aria-expanded", "false");
	},
	refresh:function(){
		var template = this._settings[this._settings.collapsed?"headerAlt":"header"] ||this._settings.header;
		if (template){
			this._headlabel.innerHTML = template();
			this._headbutton.setAttribute("aria-label", template());
		}
			
		var css = (this.getParentView()._vertical_orientation?"vertical":"horizontal");
		if(this._viewobj.className.indexOf(" "+css) < 0 ){
			smdui.html.addCss(this._viewobj, css);
		}
		//fix collapsed columns in IE8
		if(!smdui.env.transform){
			smdui.html.addCss(this._viewobj,"smdui_ie",true);
		}
	},
	_getHeaderSize:function(){
		return (this._settings.collapsed?this._settings.headerAltHeight:this._settings.headerHeight);
	},
	$setSize:function(x,y){
		if (smdui.ui.view.prototype.$setSize.call(this,x,y) || this._getHeaderSize() != this._last_set_header_size){
			x = this._content_width;
			y = this._content_height;

			var headerSize = this._last_set_header_size = this._getHeaderSize();//-(this._settings._inner.top?0:1);
			if (this._settings.header){

				this._headobj.style.height=headerSize+"px";
				this._headobj.style.width="auto";
				this._headobj.style[smdui.env.transform]="";

				
				this._headobj.style.borderBottomWidth = (this._settings.collapsed?0:1)+"px";

				if(this.getParentView()._vertical_orientation||!this._settings.collapsed){
					y-=this._getHeaderSize();
				} else if (this._settings.collapsed){
					//-2 - borders
					if (smdui.animate.isSupported()){
						this._headobj.style.width = y + "px";
						this._headobj.style.height = x + 3 + "px";
						var d = Math.floor(y/2-x/2)+(x-this._settings.headerAltHeight)/2;
						this._headobj.style[smdui.env.transform]="rotate(90deg) translate("+d+"px, "+(d+1)+"px)";
					}
					else { //IE8 fix
						this._headobj.style.width = x + "px";
						this._headobj.style.height = y + 3 + "px";
					}

				}
			}
			if(!this._settings.collapsed){
				this._body_cell.$setSize(x,y);
				this._last_size_y = y;
			}
		} else if (!this._settings.collapsed){
			var body = this._body_cell;
			if (this._last_size_y)
				body.$setSize(this._content_width, this._last_size_y);
		}
	},
	$skin:function(){
		var defaults = this.defaults;
		defaults.headerAltHeight = defaults.headerHeight = smdui.skin.$active.barHeight;
		if(smdui.skin.$active.borderlessAccordion)
			defaults.borderless = true;
	},
	defaults:{
		header:false,
		headerAlt:false,
		body:""
	}
}, smdui.MouseEvents, smdui.EventSystem, smdui.ui.view);

smdui.protoUI({
	name:"accordion",
	defaults:{
		panelClass:"accordionitem",
		multi:false,
		collapsed:false
	},
	$init:function(){
		this._viewobj.setAttribute("role", "tablist");
		this._viewobj.setAttribute("aria-multiselectable", "true");
	},
	addView:function(view){
		//adding view to the accordion
		var id = smdui.ui.layout.prototype.addView.apply(this, arguments);
		var child = smdui.$$(id);
		//repainting sub-panels in the accordion
		if (child.collapsed_setter && child.refresh) child.refresh();
		return id;
	},
	_parse_cells:function(){
		var panel = this._settings.panelClass;
		var cells = this._collection;

		for (var i=0; i<cells.length; i++){
			if ((cells[i].body || cells[i].header)&& !cells[i].view && !cells[i].align)
				cells[i].view = panel;
			if (smdui.isUndefined(cells[i].collapsed))
				cells[i].collapsed = this._settings.collapsed;

		}

	
		this._skin_render_collapse = true;
		smdui.ui.layout.prototype._parse_cells.call(this);
		this._skin_render_collapse = false;

		for (var i=0; i < this._cells.length; i++){
			if (this._cells[i].name == panel) 
				this._cells[i].refresh();
			this._cells[i]._accLastChild = false;
		}
		var found = false;
		for (var i= this._cells.length-1; i>=0 &&!found; i--){
			if(!this._cells[i]._settings.hidden){
				this._cells[i]._accLastChild = true;
				found = true;
			}
		}

	},
	_afterOpen:function(view){
		if (this._settings.multi === false && this._skin_render_collapse !== true){
			for (var i=0; i < this._cells.length; i++) {
				if (view != this._cells[i] && !this._cells[i]._settings.collapsed && this._cells[i].collapse)
					this._cells[i].collapse();
			}
		}
		if (view.callEvent){
			view.callEvent("onViewShow",[]);
			smdui.ui.each(view, this._signal_hidden_cells);
		}
	},
	_canCollapse:function(view){
		if (this._settings.multi === true || this._skin_render_collapse) return true;
		//can collapse only if you have other item to open
		for (var i=0; i < this._cells.length; i++)
			if (view != this._cells[i] && !this._cells[i]._settings.collapsed && this._cells[i].isVisible() && !this._cells[i].$nospace)
				return true;
		return false;
	},
	$skin:function(){
		var defaults = this.defaults;
		if(smdui.skin.$active.accordionType)
			defaults.type = smdui.skin.$active.accordionType;
	}
}, smdui.ui.layout);

smdui.protoUI({
	name:"headerlayout",
	defaults:{
		type: "accordion",
		multi:"mixed",
		collapsed:false
	}
}, smdui.ui.accordion);


/*
	Behavior:DND - low-level dnd handling
	@export
		getContext
		addDrop
		addDrag
		
	DND master can define next handlers
		onCreateDrag
		onDragIng
		onDragOut
		onDrag
		onDrop
	all are optional
*/



smdui.DragControl={
	//has of known dnd masters
	_drag_masters : smdui.toArray(["dummy"]),
	/*
		register drop area
		@param node 			html node or ID
		@param ctrl 			options dnd master
		@param master_mode 		true if you have complex drag-area rules
	*/
	addDrop:function(node,ctrl,master_mode){
		node = smdui.toNode(node);
		node.smdui_drop=this._getCtrl(ctrl);
		if (master_mode) node.smdui_master=true;
	},
	//return index of master in collection
	//it done in such way to prevent dnd master duplication
	//probably useless, used only by addDrop and addDrag methods
	_getCtrl:function(ctrl){
		ctrl = ctrl||smdui.DragControl;
		var index = this._drag_masters.find(ctrl);
		if (index<0){
			index = this._drag_masters.length;
			this._drag_masters.push(ctrl);
		}
		return index;
	},
	_createTouchDrag: function(e){
		var dragCtrl = smdui.DragControl;
		var master = this._getActiveDragMaster();
		// for data items only
		if(master && master._getDragItemPos){

			if(!dragCtrl._html)
				dragCtrl.createDrag(e);
			var ctx = dragCtrl._drag_context;
			dragCtrl._html.style.left= e.x+dragCtrl.left+ (ctx.x_offset||0)+"px";
			dragCtrl._html.style.top= e.y+dragCtrl.top+ (ctx.y_offset||0) +"px";
		}
	},
	/*
		register drag area
		@param node 	html node or ID
		@param ctrl 	options dnd master
	*/
	addDrag:function(node,ctrl){
	    node = smdui.toNode(node);
	    node.smdui_drag=this._getCtrl(ctrl);
		smdui._event(node,smdui.env.mouse.down,this._preStart,{ bind:node });
		smdui._event(node,"dragstart",smdui.html.preventEvent);
	},
	//logic of drag - start, we are not creating drag immediately, instead of that we hears mouse moving
	_preStart:function(e){
		if (smdui.DragControl._active){
			//if we have nested drag areas, use the top one and ignore the inner one
			if (smdui.DragControl._saved_event == e) return;
			smdui.DragControl._preStartFalse();
			smdui.DragControl.destroyDrag(e);
		}
		smdui.DragControl._active=this;

		var evobj = smdui.env.mouse.context(e);
		smdui.DragControl._start_pos=evobj;
		smdui.DragControl._saved_event = e;

		smdui.DragControl._smdui_drag_mm = smdui.event(document.body,smdui.env.mouse.move,smdui.DragControl._startDrag);
		smdui.DragControl._smdui_drag_mu = smdui.event(document,smdui.env.mouse.up,smdui.DragControl._preStartFalse);

		//need to run here, or will not work in IE
		smdui.html.addCss(document.body,"smdui_noselect", 1);
	},
	//if mouse was released before moving - this is not a dnd, remove event handlers
	_preStartFalse:function(){
		smdui.DragControl._clean_dom_after_drag();
	},
	//mouse was moved without button released - dnd started, update event handlers
	_startDrag:function(e){
		//prevent unwanted dnd
		var pos = smdui.env.mouse.context(e);
		var master = smdui.DragControl._getActiveDragMaster();
		// only long-touched elements can be dragged

		var longTouchLimit = (master && smdui.env.touch && master._getDragItemPos && !smdui.Touch._long_touched);
		if (longTouchLimit || Math.abs(pos.x-smdui.DragControl._start_pos.x)<5 && Math.abs(pos.y-smdui.DragControl._start_pos.y)<5)
			return;

		smdui.DragControl._clean_dom_after_drag(true);
		if(!smdui.DragControl._html)
			if (!smdui.DragControl.createDrag(smdui.DragControl._saved_event)) return;
		
		smdui.DragControl.sendSignal("start"); //useless for now
		smdui.DragControl._smdui_drag_mm = smdui.event(document.body,smdui.env.mouse.move,smdui.DragControl._moveDrag);
		smdui.DragControl._smdui_drag_mu = smdui.event(document,smdui.env.mouse.up,smdui.DragControl._stopDrag);
		smdui.DragControl._moveDrag(e);

		if (smdui.env.touch)
			return smdui.html.preventEvent(e);
	},
	//mouse was released while dnd is active - process target
	_stopDrag:function(e){
		smdui.DragControl._clean_dom_after_drag();
		smdui.DragControl._saved_event = null;

		if (smdui.DragControl._last){	//if some drop target was confirmed
			smdui.DragControl.$drop(smdui.DragControl._active, smdui.DragControl._last, e);
			smdui.DragControl.$dragOut(smdui.DragControl._active,smdui.DragControl._last,null,e);
		}
		smdui.DragControl.destroyDrag(e);
		smdui.DragControl.sendSignal("stop");	//useless for now
	},
	_clean_dom_after_drag:function(still_drag){
		this._smdui_drag_mm = smdui.eventRemove(this._smdui_drag_mm);
		this._smdui_drag_mu = smdui.eventRemove(this._smdui_drag_mu);
		if (!still_drag)
			smdui.html.removeCss(document.body,"smdui_noselect");
	},
	//dnd is active and mouse position was changed
	_moveDrag:function(e){
		var dragCtrl = smdui.DragControl;
		var pos = smdui.html.pos(e);
		var evobj = smdui.env.mouse.context(e);

		//give possibility to customize drag position
		var customPos = dragCtrl.$dragPos(pos, e);
		//adjust drag marker position
		var ctx = dragCtrl._drag_context;
		dragCtrl._html.style.top=pos.y+dragCtrl.top+(customPos||!ctx.y_offset?0:ctx.y_offset) +"px";
		dragCtrl._html.style.left=pos.x+dragCtrl.left+(customPos||!ctx.x_offset?0:ctx.x_offset)+"px";

		if (dragCtrl._skip)
			dragCtrl._skip=false;
		else {
			var target = evobj.target = smdui.env.touch ? document.elementFromPoint(evobj.x, evobj.y) : evobj.target;
			var touch_event = smdui.env.touch ? evobj : e;
			dragCtrl._checkLand(target, touch_event);
		}
		
		return smdui.html.preventEvent(e);
	},
	//check if item under mouse can be used as drop landing
	_checkLand:function(node,e){
		while (node && node.tagName!="BODY"){
			if (node.smdui_drop){	//if drop area registered
				if (this._last && (this._last!=node || node.smdui_master))	//if this area with complex dnd master
					this.$dragOut(this._active,this._last,node,e);			//inform master about possible mouse-out
				if (!this._last || this._last!=node || node.smdui_master){	//if this is new are or area with complex dnd master
					this._last=null;										//inform master about possible mouse-in
					this._landing=this.$dragIn(smdui.DragControl._active,node,e);
					if (this._landing)	//landing was rejected
						this._last=node;
					return;				
				} 
				return;
			}
			node=node.parentNode;
		}
		if (this._last)	//mouse was moved out of previous landing, and without finding new one 
			this._last = this._landing = this.$dragOut(this._active,this._last,null,e);
	},
	//mostly useless for now, can be used to add cross-frame dnd
	sendSignal:function(signal){
		smdui.DragControl.active=(signal=="start");
	},
	
	//return master for html area
	getMaster:function(t){
		return this._drag_masters[t.smdui_drag||t.smdui_drop];
	},
	//return dhd-context object
	getContext:function(){
		return this._drag_context;
	},
	getNode:function(){
		return this._html;
	},
	//called when dnd is initiated, must create drag representation
	createDrag:function(e){ 
		var dragCtl = smdui.DragControl;
		var a=dragCtl._active;

		dragCtl._drag_context = {};
		var master = this._drag_masters[a.smdui_drag];
        var drag_container;

		//if custom method is defined - use it
		if (master.$dragCreate){
			drag_container=master.$dragCreate(a,e);
			if (!drag_container) return false;
			this._setDragOffset(e);
			drag_container.style.position = 'absolute';
		} else {
		//overvise use default one
			var text = dragCtl.$drag(a,e);
			dragCtl._setDragOffset(e);

			if (!text) return false;
			drag_container = document.createElement("DIV");
			drag_container.innerHTML=text;
			drag_container.className="smdui_drag_zone";
			document.body.appendChild(drag_container);

			var context = dragCtl._drag_context;
			if (context.html && smdui.env.pointerevents){
				context.x_offset = -Math.round(drag_container.offsetWidth  * 0.5);
				context.y_offset = -Math.round(drag_container.offsetHeight * 0.75);
			}
		}
		/*
			dragged item must have topmost z-index
			in some cases item already have z-index
			so we will preserve it if possible
		*/
		drag_container.style.zIndex = Math.max(drag_container.style.zIndex,smdui.ui.zIndex());

		smdui.DragControl._skipDropH = smdui.event(drag_container,smdui.env.mouse.move,smdui.DragControl._skip_mark);

		if (!smdui.DragControl._drag_context.from)
			smdui.DragControl._drag_context = {source:a, from:a};
		
		smdui.DragControl._html=drag_container;
		return true;
	},
	//helper, prevents unwanted mouse-out events
	_skip_mark:function(){
		smdui.DragControl._skip=true;
	},
	//after dnd end, remove all traces and used html elements
	destroyDrag:function(e){
		var a=smdui.DragControl._active;
		var master = this._drag_masters[a.smdui_drag];

		if (master && master.$dragDestroy){
			smdui.DragControl._skipDropH = smdui.eventRemove(smdui.DragControl._skipDropH);
			if(smdui.DragControl._html)
				master.$dragDestroy(a,smdui.DragControl._html,e);
		}
		else{
			smdui.html.remove(smdui.DragControl._html);
		}
		smdui.DragControl._landing=smdui.DragControl._active=smdui.DragControl._last=smdui.DragControl._html=null;
		//smdui.DragControl._x_offset = smdui.DragControl._y_offset = null;
	},
	_getActiveDragMaster: function(){
		return smdui.DragControl._drag_masters[smdui.DragControl._active.smdui_drag];
	},
	top:5,	 //relative position of drag marker to mouse cursor
	left:5,
	_setDragOffset:function(e){
		var dragCtl = smdui.DragControl;
		var pos = dragCtl._start_pos;
		var ctx = dragCtl._drag_context;

		if(typeof ctx.x_offset != "undefined" && typeof ctx.y_offset != "undefined")
			return null;

		ctx.x_offset = ctx.y_offset = 0;
		if(smdui.env.pointerevents){
			var m=smdui.DragControl._getActiveDragMaster();

			if (m._getDragItemPos && m!==this){
				var itemPos = m._getDragItemPos(pos,e);

				if(itemPos){
					ctx.x_offset = itemPos.x - pos.x;
					ctx.y_offset = itemPos.y - pos.y;
				}

			}

		}
	},
	$dragPos:function(pos, e){
		var m=this._drag_masters[smdui.DragControl._active.smdui_drag];
		if (m.$dragPos && m!=this){
			m.$dragPos(pos, e, smdui.DragControl._html);
			return true;
		}
	},
	//called when mouse was moved in drop area
	$dragIn:function(s,t,e){
		var m=this._drag_masters[t.smdui_drop];
		if (m.$dragIn && m!=this) return m.$dragIn(s,t,e);
		t.className=t.className+" smdui_drop_zone";
		return t;
	},
	//called when mouse was moved out drop area
	$dragOut:function(s,t,n,e){
		var m=this._drag_masters[t.smdui_drop];
		if (m.$dragOut && m!=this) return m.$dragOut(s,t,n,e);
		t.className=t.className.replace("smdui_drop_zone","");
		return null;
	},
	//called when mouse was released over drop area
	$drop:function(s,t,e){
		var m=this._drag_masters[t.smdui_drop];
		smdui.DragControl._drag_context.from = smdui.DragControl.getMaster(s);
		if (m.$drop && m!=this) return m.$drop(s,t,e);
		t.appendChild(s);
	},
	//called when dnd just started
	$drag:function(s,e){
		var m=this._drag_masters[s.smdui_drag];
		if (m.$drag && m!=this) return m.$drag(s,e);
		return "<div style='"+s.style.cssText+"'>"+s.innerHTML+"</div>";
	}	
};

//global touch-drag handler
smdui.attachEvent("onLongTouch", function(ev){
	if(smdui.DragControl._active)
		smdui.DragControl._createTouchDrag(ev);
});

/*
	Behavior:DataMove - allows to move and copy elements, heavily relays on DataStore.move
	@export
		copy
		move
*/
smdui.DataMove={
	//creates a copy of the item
	copy:function(sid,tindex,tobj, details){
		details = details || {};
		var new_id = details.newId || sid;
		tobj = tobj||this;

		var data = this.getItem(sid);
		smdui.assert(data,"Incorrect ID in DataMove::copy");
		
		//make data conversion between objects
		if (tobj)
			data = tobj._externalData(data);
		
		//adds new element same as original
		return tobj.data.add(tobj._externalData(data,new_id),tindex,(details.parent || 0));
	},
	_next_move_index:function(nid, next, source){
		if (next && nid){
			var new_index = this.getIndexById(nid);
			return new_index+(source == this && source.getIndexById(next)<new_index?0:1);
		}
	},
	//move item to the new position
	move:function(sid,tindex,tobj, details){
		details = details || {};
		var new_id = details.newId || sid;

		tobj = tobj||this;
		smdui.assert(tobj.data, "moving attempt to component without datastore");
		if (!tobj.data) return;

		//can process an arrya - it allows to use it from onDrag 
		if (smdui.isArray(sid)){
			//block separate repaint operations
			if (sid.length > 3) //heuristic value, duplicated below
				this.$blockRender = tobj.$blockRender = true;

			for (var i=0; i < sid.length; i++) {
				//increase index for each next item in the set, so order of insertion will be equal to order in the array
				var nid = this.move(sid[i], tindex, tobj, details);
				tindex = tobj._next_move_index(nid, sid[i+1], this);
			}

			this.$blockRender = tobj.$blockRender = false;
			if (sid.length > 3){
				//repaint whole component
				this.refresh();
				if (tobj != this)
					tobj.refresh();
			}
			return;
		}
		
		var nid = sid; //id after moving

		var data = this.getItem(sid);
		smdui.assert(data,"Incorrect ID in DataMove::move");
		
		if (!tobj || tobj == this){
			if (tindex < 0) tindex = this.data.order.length - 1;
			this.data.move(this.getIndexById(sid),tindex);	//move inside the same object
			this.data.callEvent("onDataMove", [sid, tindex, null, this.data.order[tindex+1]]);
		} else {
			//copy to the new object
			nid = tobj.data.add(tobj._externalData(data,new_id),tindex, (details.parent || 0));
			this.data.remove(sid);//delete in old object
		}
		return nid;	//return ID of item after moving
	},
	//move item on one position up
	moveUp:function(id,step){
		return this.move(id,this.getIndexById(id)-(step||1));
	},
	//move item on one position down
	moveDown:function(id,step){
		return this.moveUp(id, (step||1)*-1);
	},
	//move item to the first position
	moveTop:function(id){
		return this.move(id,0);
	},
	//move item to the last position
	moveBottom:function(id){
		return this.move(id,this.data.count()-1);
	},
	/*
		this is a stub for future functionality
		currently it just makes a copy of data object, which is enough for current situation
	*/
	_externalData:function(data,id){
		var newdata = smdui.extend({},data);
		newdata.id = (!id || this.data.pull[id])?smdui.uid():id;
		

		newdata.$template=null;

		if (this._settings.externalData)
			newdata = this._settings.externalData.call(this, newdata, id, data);
		return newdata;
	}
};

smdui.Movable = {
	move_setter: function (value) { 
		if (value){
			this._move_admin = smdui.clone(this._move_admin);
			this._move_admin.master = this;

			smdui.DragControl.addDrag(this._headobj, this._move_admin);
		}
		return value;
	},
	_move_admin: {
		$dragCreate:function(object, e){
			if(this.master.config.move){
				var offset = smdui.html.offset(object);
				var pos = smdui.html.pos(e);
				smdui.DragControl.top = offset.y - pos.y;
				smdui.DragControl.left = offset.x - pos.x;

				return smdui.toNode(this.master._viewobj);
			}
		},
		$dragDestroy:function(node, drag){
			var view = this.master;
			if (view._settings){
				view._settings.top = parseInt(drag.style.top,10);
				view._settings.left = parseInt(drag.style.left,10);
			}

			smdui.DragControl.top = smdui.DragControl.left = 5;
			this.master.callEvent("onViewMoveEnd", []);
			return;
		},
		$dragPos:function(pos, e){
			this.master.callEvent("onViewMove", [pos, e]);
		}
	}
};

smdui.Modality = {
    _modal_set:function(value){
	    if (value){
	    	if (!this._modal_cover){
		        this._modal_cover = smdui.html.create('div',{
		        	"class":"smdui_modal"
		    	});
		    	/*	with below code we will have the same zIndex for modal layer as for the previous 
					abs positioned element, but because of attaching order modal layer will be on top anyway
		    	*/
		    	var zIndex = this._settings.zIndex||smdui.ui.zIndex();

		    	//set topmost modal layer
		    	this._previous_modality = smdui._modality;
		    	smdui._modality = zIndex;


		    	this._modal_cover.style.zIndex = zIndex-1;
		    	this._viewobj.style.zIndex = zIndex;
		        document.body.appendChild(this._modal_cover);
		        document.body.style.overflow = "hidden";
				smdui._event( this._modal_cover, "click", smdui.bind(this._ignore_clicks, this));
	        }
	    }
	    else {
	        if (this._modal_cover){
	            smdui.html.remove(this._modal_cover);
	            document.body.style.overflow = "visible";

	            //restore topmost modal layer
	        	//set delay, as current window closing may have not finished click event
	        	//need to wait while it is not fully processed
	        	var topmost = this._previous_modality;
	        	setTimeout(function(){ smdui._modality = topmost; }, 1);

	        	this._modal_cover = null;
	        }
	    }
	    return value;
    }
};
	
smdui.protoUI({
	name:"window",

	$init:function(config){
		this._viewobj.innerHTML = "<div class='smdui_win_content'><div class='smdui_win_head'></div><div class='smdui_win_body'></div></div>";
		
		this._contentobj = this._viewobj.firstChild;
		this._headobj = this._contentobj.childNodes[0];
		this._dataobj = this._bodyobj = this._contentobj.childNodes[1];
		this._viewobj.className +=" smdui_window";

		this._viewobj.setAttribute("role", "dialog");
		this._viewobj.setAttribute("tabindex", "0");
		
		this._head_cell = this._body_cell = null;
		this._settings._inner = {top:false, left:false, right:false, bottom:false }; //set border flags
		if (!config.id) config.id = smdui.uid();

		smdui._event(this._contentobj, "click", smdui.bind(this._ignore_clicks, this));

		// IE8 does not allow to define event capturing
		if(this._contentobj.addEventListener)
			smdui._event(this._contentobj, "click", function(){
				// brings a window to the front of other windows
				if(!this._settings.zIndex && this._settings.toFront){
					this._viewobj.style.zIndex = smdui.ui.zIndex();
				}
			}, {bind:this, capture: true});

		// hidden_setter handling
		if(config.modal)
			this._modal = true;

		this.attachEvent("onViewMoveEnd", function(){
			if(this._settings.position)
				delete this._settings.position;
		});
	},
	_ignore_clicks:function(e){
		var popups = smdui.ui._popups;
		var index = popups.find(this);
		if (index == -1)
			index = popups.length - 1;

		e.click_view = index;
		if (smdui.env.isIE8)
			e.srcElement.click_view = index;
	},
	getChildViews:function(){
		if (this._head_cell)
			return [this._head_cell, this._body_cell];
		else
			return [this._body_cell];
	},
	zIndex_setter:function(value){
        this._viewobj.style.zIndex = value;
        return value;
    },
	_remove:function(){ 
		this._body_cell = { destructor:function(){} };	
	},
	_replace:function(new_view){
		this._body_cell.destructor();
		this._body_cell = new_view;
		this._body_cell._parent_cell = this;
		
		this._bodyobj.appendChild(this._body_cell._viewobj);

		var cell = this._body_cell._viewobj.style;
		cell.borderTopWidth = cell.borderBottomWidth = cell.borderLeftWidth = cell.borderRightWidth = "1px";
		this._body_cell._settings._inner = smdui.clone(this._settings._inner);

		this.resize(true);
	},
	show:function(node, mode, point){
		if (node === true){
			//recursive call from some child item
			if (!this._settings.hidden)
				return;
			node = null;
		}

		if(!this.callEvent("onBeforeShow",arguments))
			return false;

		this._settings.hidden = false;
		this._viewobj.style.zIndex = (this._settings.zIndex||smdui.ui.zIndex());
		if (this._settings.modal || this._modal){
			this._modal_set(true);
			this._modal = null; // hidden_setter handling
		}

		var pos, dx, dy;
		mode = mode || {};
		if (!mode.pos)
			mode.pos = this._settings.relative;

		//get position of source html node
		//we need to show popup which pointing to that node
		if (node){
			//if event was provided - get node info from it
			if (typeof node == "object" && !node.tagName){
				/*below logic is far from ideal*/
				if (node.target || node.srcElement){
					pos = smdui.html.pos(node);
					dx = 20;
					dy = 5;
				} else
					pos = node;

				
			} else {
				node = smdui.toNode(node);
				smdui.assert(node,"Not existing target for window:show");
				pos = smdui.html.offset(node);
			}	

			//size of body, we need to fit popup inside
			var x = Math.max(window.innerWidth || 0, document.body.offsetWidth);
			var y = Math.max(window.innerHeight || 0, document.body.offsetHeight);

			//size of node, near which popup will be rendered
			dx = dx || node.offsetWidth  || 0;
			dy = dy || node.offsetHeight || 0;
			//size of popup element
			var size = this._last_size;

 			var fin_x = pos.x;
			var fin_y = pos.y;
			var point_y=0;
			var point_x = 0;

			var fit = this._settings.autofit;
			if (fit){
				var nochange = (fit === "node");
				var delta_x = 6; var delta_y=6; var delta_point = 6;

				//default pointer position - top 
				point = "top";
				fin_y=0; fin_x = 0;

				var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft;
				//if we want to place menu at righ, but there is no place move it to left instead
				if (x - pos.x - dx < size[0] && mode.pos == "right" && !nochange)
					mode.pos = "left";

				if (mode.pos == "right"){
					fin_x = pos.x+delta_x+dx; 
					delta_y = -dy;
					point = "left";
					point_y = Math.round(pos.y+dy/2);
					point_x = fin_x - delta_point;
				} else if (mode.pos == "left"){
					fin_x = pos.x-delta_x-size[0]-1;
					delta_y = -dy;
					point = "right";
					point_y = Math.round(pos.y+dy/2);
					point_x = fin_x + size[0]+1;
				} else  {
					//left border of screen
					if (pos.x < scrollLeft){
						fin_x = scrollLeft;
					//popup exceed the right border of screen
					} else if (x+scrollLeft-pos.x > size[0]){
						fin_x = pos.x; //aligned
					} else{
						fin_x = x+scrollLeft-delta_x-size[0]; //not aligned
					}

					point_x = Math.round(pos.x+dx/2);
					//when we have a small popup, point need to be rendered at center of popup
					point_x = Math.min(point_x, fin_x + size[0] - delta_point*3);
				}
				
				//if height is not fixed - use default position
				var scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
				if (((!size[1] || (y+scrollTop-dy-pos.y-delta_y > size[1])) || nochange) && mode.pos != "top"){
					//bottom	
					fin_y = dy+pos.y+delta_y - 4;
					if (!point_y){
						point = "top";
						point_y = fin_y-delta_point;
					}
				} else {
					//top
					fin_y = pos.y-delta_y - size[1];
					if (fin_y < 0){
						fin_y = 0; 
						//left|right point can be used, but there is no place for top point
						if (point == "top") point = false;
					} else if (!point_y){
						point = "bottom";
						fin_y --;
						point_y = fin_y+size[1]+1;
					}
				}
			}

			var deltax = (mode.x || 0);
			var deltay = (mode.y || 0);
			this.setPosition(fin_x+deltax, fin_y+deltay);
			if (this._set_point){
				if (point)
					this._set_point(point,point_x+deltax, point_y+deltay);
				else
					this._hide_point();
			}
		} else if (this._settings.position)
			this._setPosition();

		this._viewobj.style.display = "block";
		this._hide_timer = 1;
		smdui.delay(function(){ this._hide_timer = 0; }, this, [], (smdui.env.touch ? 400 : 100 ));
		
		this._render_hidden_views();
		
		
		if (this.config.autofocus){
			this._prev_focus = smdui.UIManager.getFocus();
			smdui.UIManager.setFocus(this);
		}

		if (-1 == smdui.ui._popups.find(this))
			smdui.ui._popups.push(this);

		this.callEvent("onShow",[]);
	}, 
	_hide:function(e){
		//do not hide modal windows
		if (this._settings.hidden || this._settings.modal || this._hide_timer || (e && e.showpopup)) return;
		//do not hide popup, when we have modal layer above the popup
		if (smdui._modality && this._settings.zIndex <= smdui._modality) return;

		//ignore inside clicks and clicks in child-popups

		if (e){
			var index = smdui.env.isIE8 ? e.srcElement.click_view : e.click_view;
			if (!index && index !== 0) index = -1;

			var myindex = smdui.ui._popups.find(this);

			if (myindex <= index) return;
		}

		this.hide();
	},
	hidden_setter:function(value){
		if(value) 
			this.hide();
		else
			this.show();
		return !!value;
	},
	hide:function(force){
		if (this.$destructed) return;

		if (!force)
			if(this._settings.hidden) return;

		if (this._settings.modal)
			this._modal_set(false);
			
		if (this._settings.position == "top"){
			smdui.animate(this._viewobj, {type: 'slide', x:0, y:-(this._content_height+20), duration: 300,
											callback:this._hide_callback, master:this});
		}
		else 
			this._hide_callback();

		if (this._settings.autofocus){
			var el = document.activeElement;
			//as result of hotkey, we can have a activeElement set to document.body
			if (el && this._viewobj && (this._viewobj.contains(el) || el === document.body)){
				smdui.UIManager.setFocus(this._prev_focus);
				this._prev_focus = null;
			}
		}

		this._hide_sub_popups();
	},
	//hide all child-popups
	_hide_sub_popups:function(){
		var order = smdui.ui._popups;
		var index = order.find(this);
		var size = order.length - 1;

		if (index > -1)
			for (var i = size; i > index; i--)
				if (order[i]._hide_point)	//hide only popups, skip windows
					order[i].hide();
		
		order.removeAt(index);
	},
	destructor: function() {
		this._modal_set(false);
		smdui.html.remove(this._viewobj);
		
		if (this._settings.autofocus){
			if (!smdui._final_destruction)
				smdui.UIManager.setFocus(this._prev_focus);
			this._prev_focus = null;
		}
		
		this._hide_sub_popups();
		if (this._hide_point)
			this._hide_point();
		smdui.Destruction.destructor.apply(this, []);
	},
	_hide_callback:function(){
		if (!this.$destructed){
			this._viewobj.style.display = "none";
			this._settings.hidden = true;
			this.callEvent("onHide",[]);
		}
	},
	close:function(){
		this.destructor(); 
	},
	_inner_body_set:function(value){
		value.borderless = true;
	},
	body_setter:function(value){
		if (typeof value != "object")
			value = {template:value };
		this._inner_body_set(value);

		smdui._parent_cell = this;
		this._body_cell = smdui.ui._view(value);
		this._body_cell._parent_cell = this;

		this._bodyobj.appendChild(this._body_cell._viewobj);
		return value;
	},
	head_setter:function(value){
		if (value === false) return value;
		if (typeof value != "object"){
			this._viewobj.setAttribute("aria-label", value);
			value = { template:value, padding:0 };
		}
		
		value.borderless = true;

		smdui._parent_cell = this;
		this._head_cell = smdui.ui._view(value);
		this._head_cell._parent_cell = this;

		this._headobj.appendChild(this._head_cell._viewobj);
		return value;
	},
	getBody:function(){
		return this._body_cell;
	},
	getHead:function(){
		return this._head_cell;
	},
	adjust:function(){ return this.resize(); },
	resizeChildren:function(){
		if (this._body_cell)
			this.resize();
	},
	resize:function(){
		smdui.ui.baseview.prototype.adjust.call(this);
		this._setPosition(this._settings.left, this._settings.top);
	},
	_setPosition:function(x,y){
		if (this._settings.position){
			this.$view.style.position = "fixed";

			var width = this._content_width;
			var height = this._content_height;
			smdui.assert(width && height, "Attempt to show not rendered window");

			var maxWidth = (window.innerWidth||document.documentElement.offsetWidth);
			var maxHeight = (window.innerHeight||document.documentElement.offsetHeight);
			var left = Math.round((maxWidth-width)/2);
			var top = Math.round((maxHeight-height)/2);

			if (typeof this._settings.position == "function"){
				var state = { 	left:left, top:top, 
								width:width, height:height, 
								maxWidth:maxWidth, maxHeight:maxHeight };
				this._settings.position.call(this, state);
				if (state.width != width || state.height != height)
					this.$setSize(state.width, state.height);

				this.setPosition(state.left, state.top);
			} else {
				if (this._settings.position == "top"){
					if (smdui.animate.isSupported())
						top = -1*height;
					else
						top = 10;
				}
				this.setPosition(left, top);
			}
			
			if (this._settings.position == "top")
				smdui.animate(this._viewobj, {type: 'slide', x:0, y:height-((this._settings.padding||0)*2), duration: 300 ,callback:this._topPositionCallback, master:this});
		} else 
			this.setPosition(x,y);
	},
	_topPositionCallback:function(node){
		smdui.animate.clear(node);
		this._settings.top=-((this._settings.padding||0)*2);
		this.setPosition(this._settings.left, this._settings.top);
	},
	setPosition:function(x,y){
		this._viewobj.style.top = y+"px";
		this._viewobj.style.left = x+"px";
		this._settings.left = x; this._settings.top=y;
	},
	$getSize:function(dx, dy){
		var _borders = this._settings._inner;
		if (_borders){
			dx += (_borders.left?0:1)+(_borders.right?0:1);
			dy += (_borders.top?0:1)+(_borders.bottom?0:1);
		}
		//line between head and body
		if (this._settings.head)
			dy += 1;

		var size =  this._body_cell.$getSize(0,0);
		var headMinWidth = 0;
		if (this._head_cell){
			var head_size = this._head_cell.$getSize(0,0);
			if (head_size[3]==head_size[2])
				this._settings.headHeight = head_size[3];
			dy += this._settings.headHeight;
			headMinWidth = head_size[0];
		}

		if (this._settings.fullscreen){
			var width = window.innerWidth || document.body.clientWidth;
			var height = window.innerHeight || document.body.clientHeight;
			return [width, width, height, height];
		}

		//get layout sizes
		var self_size = smdui.ui.view.prototype.$getSize.call(this, 0, 0);

		//use child settings if layout's one was not defined
		if (headMinWidth && size[1] > 100000)
			size[0] = Math.max(headMinWidth, size[0]);

		self_size[1] = Math.min(self_size[1],(size[1]>=100000&&self_size[1]>=100000?Math.max(size[0], 300):size[1])+dx);
		self_size[3] = Math.min(self_size[3],(size[3]>=100000&&self_size[3]>=100000?Math.max(size[2], 200):size[3])+dy);

		self_size[0] = Math.min(Math.max(self_size[0],size[0] + dx), self_size[1]);
		self_size[2] = Math.min(Math.max(self_size[2],size[2] + dy), self_size[3]);

		return self_size;
	},
	$setSize:function(x,y){
		smdui.ui.view.prototype.$setSize.call(this,x,y);
		x = this._content_width;
		y = this._content_height;
		if (this._settings.head === false) {
			this._headobj.style.display="none";
			this._body_cell.$setSize(x,y);
		} else { 
			this._head_cell.$setSize(x,this._settings.headHeight);
			this._body_cell.$setSize(x,y-this._settings.headHeight);
		}
	},
	$skin:function(){
		this.defaults.headHeight = smdui.skin.$active.barHeight;
	},
	defaults:{
		top:0,
		left:0,
		autofit:true,
		relative:"bottom",
		body:"",
		head:"",
		hidden: true,
		autofocus:true
	}
}, smdui.ui.view, smdui.Movable, smdui.Modality, smdui.EventSystem);

smdui.protoUI({
	name:"popup",
	$init:function(){
		this._settings.head = false;
		this.$view.className += " smdui_popup";
		smdui.attachEvent("onClick", smdui.bind(this._hide, this));
		this.attachEvent("onHide", this._hide_point);
	},
	$skin:function(){
		this.defaults.headHeight = smdui.skin.$active.barHeight;
		this.defaults.padding = smdui.skin.$active.popupPadding;
	},
    close:function(){
        smdui.html.remove(this._point_element);
        smdui.ui.window.prototype.close.call(this);
	},
	$getSize:function(x,y){
		return smdui.ui.window.prototype.$getSize.call(this, x+this._settings.padding*2,y+this._settings.padding*2);
	},
	$setSize:function(x,y){
			smdui.ui.view.prototype.$setSize.call(this,x,y);
			x = this._content_width-this._settings.padding*2;
			y = this._content_height-this._settings.padding*2;
			this._contentobj.style.padding = this._settings.padding+"px";
			this._headobj.style.display="none";
			this._body_cell.$setSize(x,y);
	},
	//redefine to preserve inner borders
	_inner_body_set:function(){},
	head_setter:function(){
	},
	_set_point:function(mode, left, top){
		this._hide_point();
		document.body.appendChild(this._point_element = smdui.html.create("DIV",{ "class":"smdui_point_"+mode },""));
		this._point_element.style.zIndex = smdui.ui.zIndex();
		this._point_element.style.top = top+"px";
		this._point_element.style.left = left+"px";
	},
	_hide_point:function(){
		this._point_element = smdui.html.remove(this._point_element);
	}
}, smdui.ui.window);

smdui.ui._popups = smdui.toArray();

smdui.extend(smdui.ui.window, {
	resize_setter:function(value){
		if (value && !this._resizeHandlers)
			this._renderResizeHandler();

		return value;
	},
	_renderResizeHandler: function(){
		if(!this._rwHandle){
			this._viewobj.firstChild.style.position = "relative";
			this._rwHandle = smdui.html.create("DIV",{
				"class"	: "smdui_resize_handle"
			});
			this._viewobj.firstChild.appendChild(this._rwHandle);
			smdui._event(this._rwHandle, smdui.env.mouse.down, this._wrDown, {bind:this});
		}
	},
	_showResizeFrame: function(width,height){
		if(!this._resizeFrame){
			this._resizeFrame = smdui.html.create("div", {"class":"smdui_resize_frame"},"");
			document.body.appendChild(this._resizeFrame);
			var pos = smdui.html.offset(this._viewobj);
			this._resizeFrame.style.left = pos.x+"px";
			this._resizeFrame.style.top = pos.y+"px";
			this._resizeFrame.style.zIndex = smdui.ui.zIndex();
		}

		this._resizeFrame.style.width = width + "px";
		this._resizeFrame.style.height = height + "px";
	},
	_wrDown:function(e){
		if (this.config.resize){
			smdui.html.addCss(document.body,"smdui_noselect smdui_resize_cursor");
			this._wsReady = smdui.html.offset(this._viewobj);

			this._resizeHandlersMove = smdui.event(document.body, smdui.env.mouse.move, this._wrMove, {bind:this});
			this._resizeHandlersUp   = smdui.event(document.body, smdui.env.mouse.up, this._wrUp, {bind:this});
		}
	},
	_wrMove:function(e){
		if (this._wsReady !== false){
			var pos = smdui.html.pos(e);
			var progress = {x:pos.x - this._wsReady.x+10, y: pos.y - this._wsReady.y+10};

			if (Math.abs(this._wsReady.x - pos.x) < (this.config.minWidth||100) || Math.abs(this._wsReady.y - pos.y) < (this.config.maxHeight||100))
				return;

			this._wsProgress = progress;
			this._showResizeFrame(progress.x,progress.y);
		}
	},
	_wrUp:function(){
		// remove resize frame and css styles
		if (this._resizeFrame)
			this._resizeFrame = smdui.html.remove(this._resizeFrame);
		
		smdui.html.removeCss(document.body,"smdui_resize_cursor");
		smdui.html.removeCss(document.body,"smdui_noselect");
		smdui.eventRemove(this._resizeHandlersMove);
		smdui.eventRemove(this._resizeHandlersUp);

		// set Window sizes
		if (this._wsProgress){
			this.config.width = this._wsProgress.x;
			this.config.height = this._wsProgress.y;
			this.resize();
		}

		this._wsReady = this._wsProgress = false;
		this.callEvent("onViewResize",[]);
	}
});

smdui.protoUI({
	name:"suggest",
	defaults:{
		autofocus:false,
		type:"list",
		keyPressTimeout:1,
		body:{
			yCount:10,
			autoheight:true,
			body:true,
			select:true,
			borderless:true,
			navigation:true
		},
		filter:function(item,value){
			if (item.value.toString().toLowerCase().indexOf(value.toLowerCase())===0) return true;
   			return false;
		}
	},
	template_setter:smdui.template,
    filter_setter:function(value){
        return smdui.toFunctor(value, this.$scope);
    },
	$init:function(obj){
		var temp = {};
		smdui.extend(temp, smdui.copy(this.defaults.body));
		temp.view = obj.type || this.defaults.type;

		var etemp = this._get_extendable_cell(temp);
		if (obj.body)
			smdui.extend(etemp, obj.body, true);

		if (obj.data)
			etemp.data = obj.data;
		if (obj.url)
			etemp.url = obj.url;
		if (obj.datatype)
			etemp.datatype = obj.datatype;

		if (obj.id)
			temp.id = temp.id || (obj.id+"_"+temp.view);

		obj.body = temp;
		this.$ready.push(this._set_on_popup_click);

		this.attachEvent("onShow", function(){
			if (this._settings.master){
				var master = smdui.$$(this._settings.master);
				if(master){
					var node = master._getInputDiv ? master._getInputDiv() : master.getInputNode();
					node.setAttribute("aria-expanded", "true");
				}
					
			}
			this._show_selection();
		});
		this.attachEvent("onHide", function(){
			if (this._settings.master){
				var master = smdui.$$(this._settings.master);
				if(master){
					var node = master._getInputDiv ? master._getInputDiv() : master.getInputNode();
					node.setAttribute("aria-expanded", "false");
				}
					
			}
		});
		this._old_text = {};
	},
	_get_extendable_cell:function(obj){
		return obj;
	},
	_preselectMasterOption: function(data){
		var master, node, text = "";

		if (data){
			if (this._settings.master){
				master = smdui.$$(this._settings.master);
				node = master.getInputNode();
				if(node && master.$setValueHere){
					master.$setValueHere(data.value);
				}
				else if (node){
					if(master.options_setter)
						text = this.getItemText(data.id);
					else if(data.value)
						text = master._get_visible_text ? master._get_visible_text(data.value) : data.value.toString();

					if (smdui.isUndefined(node.value))
						node.innerHTML = text;
					else
						node.value = text.replace(/<[^>]*>/g,"");
				}
			}
		}
		node = node || this._last_input_target;
		if(node)
			node.focus();
	},
	setMasterValue:function(data, refresh){
		var text = data.id ? this.getItemText(data.id) : (data.text||data.value);

		if (this._settings.master){
			var master = smdui.$$(this._settings.master);
			if (refresh && data.id)
				master.refresh();
			else if (master.options_setter)
				master.setValue(data.$empty?"":data.id);
			else if(master.setValueHere)
				master.setValueHere(text);
			else
				master.setValue(text);
		} else if (this._last_input_target){
			this._last_input_target.value = text;
		}

		if (!refresh){
			this.hide(true);
			if (this._last_input_target)
				this._last_input_target.focus();
		}
		this.callEvent("onValueSuggest", [data, text]);
		smdui.delay(function(){
			 smdui.callEvent("onEditEnd",[]);
		});
	},
	getMasterValue:function(){
		if (this._settings.master)
			return smdui.$$(this._settings.master).getValue();
		return null;
	},
	getItemId:function(text){
		var list = this.getList();
		var type = list.type;
		for (var key in list.data.pull){
			var obj = list.getItem(key);
			if (this._settings.filter.call(this, obj, text))
				return obj.id;
		}
	},
	getItemText:function(id){
		var item = this.getList().getItem(id);

		if (!item)
			return this._old_text[id] || "";

		if (this._settings.template)
			return this._settings.template.call(this, item, this.type);

		if (this._settings.textValue)
			return item[this._settings.textValue];
		
		var type = this.getList().type;
		var text = type.template.call(type, item, type);

		return (this._old_text[id] = text);
	},
	getSuggestion:function(){
		var id,
			list = this.getList(),
			order = list.data.order;

		if (list.getSelectedId)
			id = list.getSelectedId();

		if (order.length && (!id || order.find(id) <0) )
			id = order[0];

		//complex id in datatable
		if (id && typeof id == "object") id = id+"";
		return id;
	},
	getList:function(){
		return this._body_cell;
	},
	_set_on_popup_click:function(){
		var list = this.getList();
		var type = this._settings.type;

		if (list.count){
			list.attachEvent("onItemClick", smdui.bind(function(item){
				this.setMasterValue(list.getItem(item));
			}, this));
			list.data.attachEvent("onstoreupdated",smdui.bind(function(id, obj, mode){
				if (mode == "delete" && id == this.getMasterValue())
					this.setMasterValue({ id:"", text:"" }, 1);
				else if (mode == "update" && id == this.getMasterValue()){
					this.setMasterValue(obj, 1);
				}
			}, this));
			list.data.attachEvent("onAfterFilter", smdui.bind(this._suggest_after_filter, this));
			list.data.attachEvent("onStoreLoad", smdui.bind(this._suggest_after_filter, this));
			if (smdui.isUndefined(this._settings.fitMaster))
				this._settings.fitMaster = true;
		} else if (type == "calendar"){
			list.attachEvent("onDateSelect", function(date){
				this.getParentView().setMasterValue({ value:date});
			});
			list.attachEvent("onTodaySet", function(date){
				this.getParentView().setMasterValue({ value:date});
			});
			list.attachEvent("onDateClear", function(date){
				this.getParentView().setMasterValue({ value:date});
			});
		} else if (type == "colorboard"){
			list.attachEvent("onItemClick", function(value){
				this.getParentView().setMasterValue({ value:value });
			});
		}
	},
	input_setter: function(value) {
		this.linkInput(value);
		return 0;
	},
	linkInput: function(input){
		var node;
		if (input.getInputNode){
			node = input.getInputNode();
			node.smdui_master_id = input._settings.id;
		} else
			node = smdui.toNode(input);

		smdui._event(node,"keydown",function(e){
			if ((node != document.body || this.isVisible()) && (input.config ? (!input.config.readonly) : (!node.getAttribute("readonly"))))
				this._suggestions(e);
		},{bind:this});
		
		if(input._getInputDiv)
			node = input._getInputDiv();
		
		node.setAttribute("aria-autocomplete", "list");
		node.setAttribute("aria-expanded", "false");

		if(node.tagName === "DIV"){
			node.setAttribute("aria-live", "assertive");
			node.setAttribute("aria-atomic", "true");
		}

		this._non_ui_mode = true;
	},
	_suggestions: function(e){
		e = (e||event);
		var list = this.getList();
		
		var trg = e.target||e.srcElement;

		this._last_input_target = trg;
		this._settings.master = trg.smdui_master_id;

		window.clearTimeout(this._key_timer);

		var code = e.keyCode;
		//shift and ctrl
		if (code == 16 || code == 17) return;

		// tab - hide popup and do nothing
		if (code == 9)
			return this._tab_key(this,list);

		// escape - hide popup
		if (code == 27)
			return this._escape_key(this,list);

		// enter
		if (code == 13)
			return this.$enterKey(this,list);

		// up/down/right/left are used for navigation
		if (this._navigate(e)) {
			smdui.html.preventEvent(e);
			return false;
		}

		if (smdui.isUndefined(trg.value)) return;

		clearTimeout(this._last_delay);
		this._last_delay = smdui.delay(function(){
			//focus moved to the different control, suggest is not necessary
			if (!this._non_ui_mode && 
					smdui.UIManager.getFocus() != smdui.$$(this._settings.master)) return;

			this._resolve_popup = true;
			//for multicombo
			var val = trg.value;

			// used to prevent showing popup when it was initialized
			if (list.config.dataFeed)
				list.filter("value", val);
			else if (list.filter){
				list.filter(smdui.bind(function(item){
					return this._settings.filter.call(this,item,val);
				}, this));
			}
		},this, [], this._settings.keyPressTimeout);
	},
	_suggest_after_filter: function() {
		if (!this._resolve_popup) return true;
		this._resolve_popup = false;

		var list = this.getList();
		
		// filtering is complete
		// if there are as min 1 variant it must be shown, hidden otherwise
		if (list.count() >0){
			this.adjust();
			if(!this.isVisible())
				this._dont_unfilter = true;
			this.show(this._last_input_target,null,true);
			this._dont_unfilter = false;
		} else {
			this.hide(true);
			this._last_input_target = null;
		}
	},

	show:function(node){
		if (!this.isVisible()){
			var list = this.getList();
			if (list.filter && !this._dont_unfilter){
				list.filter("");
			}

			if(this.$customWidth){
				this.$customWidth(node);
			}
			if (node.tagName && this._settings.fitMaster){
				this._settings.width = node.offsetWidth -2 ; //2 - borders
			}
			if (list._zoom_level)
				list.render();

			this.adjust();

			// needed to return focus
			if(node.tagName == "INPUT")
				this._last_input_target = node;
		}
		smdui.ui.popup.prototype.show.apply(this, arguments);
	},
	_show_selection:function(list){
		list = list||this.getList();
		var value = this.getMasterValue();

		if( list.select && list.showItem ){

			if (value && list.exists && list.exists(value)){
				list.select(value);
				list.showItem(value);
			}
			else{
				list.unselect();
				list.showItem(list.getFirstId());
			}
		}
		else if(list.setValue){
			if (this._settings.master)
				value = smdui.$$(this._settings.master).$prepareValue(value);
			list.setValue(value);
		}
	},
	$enterKey: function(popup,list) {
		var value;

		if (popup.isVisible()) {
			if (list.count && list.count()){
				value = list.getSelectedId(false, true);
				if(list.count()==1 && list.getFirstId()!=value)
					value = list.getFirstId();
				if(value)
					value = list.getItem(value);
			}
			else if(list.getSelectedDate && list.getSelectedDate())
				value = { value:list.getSelectedDate() };
			else if(list.getValue && list.getValue())
				value = {value: list.getValue() };
			
			if (value)
				this.setMasterValue(value);
			
			popup.hide(true);
		}
		else
			popup.show(this._last_input_target);
	},
	_escape_key: function(popup, list) {
		return popup.hide(true);
	},
	_tab_key: function(popup, list) {
		return popup.hide(true);
	},
	/*! suggestions navigation: up/down buttons move selection
	 *	@param e
	 *		event object
	 **/
	_navigate: function(e) {
		var list = this.getList();
		var code = e.keyCode;
		var data;

		if( list.moveSelection && code < 41 && code > 32 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
			// down arrow
			if (code === 40 ) {
				var visible = this.isVisible();
				if (!visible)
					this.show(this._last_input_target);
				
				list.moveSelection("down");
			}// other arrows
			else {
				var master = this._settings.master;
				if((list.count && code !==38) || (!list.count && !list.isVisible()))
					return false;

				var dir;
				if(code == 33) dir = "pgup";
				if(code == 34) dir = "pgdown";
				if(code == 35) dir = "bottom";
				if(code == 36) dir = "top";
				if(code == 37) dir = "left";
				if(code == 38) dir = "up";
				if(code == 39) dir = "right";

				list.moveSelection(dir);
			}
			if(list.count)
				data = list.getSelectedItem();
			else if(list.getSelectedDate)
				data = { value:list.getVisibleDate()};
			else if(list.getValue)
				data = { value:list.getValue() };
			
			this._preselectMasterOption(data);
			return true;
		}

		return false;
	},
	getValue:function(){
		var list = this.getList();
		var  value = (list.getValue ? list.getValue() : list.getSelectedId()) || "";
		value = value.id || value;

		// check empty
		if(list.getItem){
			var item = list.getItem(value);
			if(item && item.$empty)
				return "";
		}
		return value;
	},
	setValue:function(value){
		var list = this.getList();
		if(value){
            if(list.exists(value)){
                list.select(value);
                list.showItem(value);
            }
        }else{
            list.unselect();
            list.showItem(list.getFirstId());
        }
	}
}, smdui.ui.popup);


/*aria-style handling for options of multiple-value controls (radio, segmented, tabbar)*/

smdui.HTMLOptions = {
	$init:function(config){
		if(smdui.skin.$active.customRadio || this.addOption)
			smdui._event( this.$view, "keydown", this._moveSelection, {bind:this});
	},
	_focus: function(){
		var input = this._getInputNode();
		if(input)
			for(var i=0; i<input.length; i++){
				if(input[i].getAttribute("tabindex") == "0")
					input[i].focus();
			}
	},
	_blur: function(){
		var input = this._getInputNode();
		if(input)
			for(var i=0; i<input.length; i++){
				if(input[i].getAttribute("tabindex") == "0") input[i].blur();
			}
	},
	_moveSelection:function(e){
		var code = e.which || e.keyCode;

		var startCode = this.addOption?34:36;

		if(code>startCode && code <41){
			smdui.html.preventEvent(e);
			var index;
			var inp = this._getInputNode();

			if(code == 35) index = inp.length-1;
			else if(code === 36 ) index = 0;
			else{
				var dir = (code === 37 || code ===38)?-1:1;
				for(var i =0; i<inp.length; i++){
					if(inp[i].getAttribute("tabindex") == "0"){
						index = i + dir;
						if(index<0) index = inp.length-1;
						else if(index>=inp.length) index = 0;
						break;
					}
				}
			}
			if(!smdui.isUndefined(index)){
				var id = this.addOption ? inp[index].getAttribute("button_id") : inp[index].value;
				if(smdui.skin.$active.customRadio && !this.addOption)
					inp = this.$view.getElementsByTagName("BUTTON");

				this.setValue(id);
				inp[index].focus();
			}
		}
	}
};

smdui.attachEvent("onClick", function(e){
	var element = smdui.$$(e);
	if (element && element.touchable){
		smdui.UIManager.applyChanges(element);

		//for inline elements - restore pointer to the master element
		element.getNode(e);
		//reaction on custom css elements in buttons
		var trg=e.target||e.srcElement;
		if (trg.className == "smdui_disabled")
			return;

		var css = "";
		var id = null;
		var found = false;
		if (trg.className && trg.className.toString().indexOf("smdui_view")===0) return;

		if (element)
			smdui.UIManager._focus_action(element);

		//loop through all parents
		while (trg && trg.parentNode){
			if (trg.getAttribute){
				if (trg.getAttribute("view_id"))
					break;
					
				css=trg.className;
				if (css){
					css = css.toString().split(" ");
					for (var i =0; i<css.length; i++){
						if (element.on_click[css[i]]){
							var res =  element.on_click[css[i]].call(element,e,element._settings.id,trg);
							if (res===false)
								return;
						}
					}
				}
			}
			trg=trg.parentNode;
		}


		if (element._settings.click){
			var code = smdui.toFunctor(element._settings.click, element.$scope);
			if (code && code.call) code.call(element, element._settings.id, e);
		}



		var popup = element._settings.popup;
		if (element._settings.popup && !element._settings.readonly){
			if (typeof popup == "object" && !popup.name)
				popup = element._settings.popup = smdui.ui(popup)._settings.id;

			var popup = smdui.$$(popup);
			smdui.assert(popup, "Unknown popup");

			if (!popup.isVisible()){
				popup._settings.master = element._settings.id;
				popup.show((element.getInputNode()||element.getNode()),null,true);
			}
		}

		element.callEvent("onItemClick", [element._settings.id, e]);
	}
});

smdui.protoUI({
	name:"button",
	touchable:true,
	$skin:function(){
		this.defaults.height = smdui.skin.$active.buttonHeight||smdui.skin.$active.inputHeight;
		//used in "text"
		this._labelTopHeight = smdui.skin.$active.labelTopHeight||15;
		this._borderWidth = smdui.skin.$active.borderWidth;
	},
	defaults:{
		template:function(obj, common){
			var text = common.$renderInput(obj, common);
			if (obj.badge) text = text.replace("</button>", "<span class='smdui_badge'>"+obj.badge+"</span></button>");
			return "<div class='smdui_el_box' style='width:"+obj.awidth+"px; height:"+obj.aheight+"px'>"+ text + "</div>";
		},
		label:"",
		borderless:true
	},
	$renderInput:function(obj){
		var css = "class='smduitype_"+(obj.type||"base")+"' ";
		return "<button type='button' "+(obj.popup?"aria-haspopup='true'":"")+css+">"+smdui.template.escape(obj.label||obj.value)+"</button>";
	},
	$init:function(config){
		this._viewobj.className += " smdui_control smdui_el_"+(this.$cssName||this.name);

		this.data = this._settings;
		this._dataobj = this._viewobj;

		this._calc_size(config);
	},
	hotkey_setter: function(key){
		var control = this;
		this._addElementHotKey(key, function(view,ev){
			var elem = control.$view.firstChild;
			smdui.html.triggerEvent(elem, "MouseEvents", "click");
			smdui.html.preventEvent(ev);
		});
	},

	_addElementHotKey: function(key, func, view){
		var keyCode = smdui.UIManager.addHotKey(key, func, view);
		this.attachEvent("onDestruct", function(){
			smdui.UIManager.removeHotKey(keyCode, func, view);
		});
	},
	tooltip_setter: function(value){
		var box = this._getBox() || this.$view.firstChild;
		if(box)
			box.title = value;
		return value;
	},
	type_setter:function(value){
		if (this._types[value])
			this.$renderInput = smdui.template(this._types[value]);
		if (value == 'prev' || value == 'next')
			this._set_inner_size = this._set_inner_size_next;
		else
			this._set_inner_size = false;
		return value;
	},
	_types:{
		htmlbutton: "<button type='button' class='smdui_el_htmlbutton smduitype_base'>#label#</button>",

		prev:"<input type='button' class='smduitype_prev' value='#label#' /><div class='smdui_el_arrow smduitype_prev_arrow'></div>",
		next:"<input type='button' class='smduitype_next' value='#label#' /><div class='smdui_el_arrow smduitype_next_arrow'></div>",

		imageButton:"<button type='button' class='smdui_img_btn_abs smduitype_base' style='width:100%; line-height:#cheight#px'><div class='smdui_image' style='width:#dheight#px;height:#dheight#px;background-image:url(#image#);'> </div> #label#</button>",
		imageButtonTop:"<button type='button' class='smdui_img_btn_abs smdui_img_btn_abs_top smduitype_base'><div class='smdui_image' style='width:100%;height:100%;background-image:url(#image#);'> </div> <div class='smdui_img_btn_text'>#label#</div></button>",

		image:"<button type='button' class='smdui_img_btn' style='line-height:#cheight#px;'><div class='smdui_image' style='width:#cheight#px;height:#cheight#px;background-image:url(#image#);'> </div> #label#</button>",
		imageTop:"<button type='button' class='smdui_img_btn_top'><div class='smdui_image' style='width:100%;height:100%;background-image:url(#image#);'></div> <div class='smdui_img_btn_text'>#label#</div></button>",

		icon:"<button type='button' class='smdui_img_btn' style='line-height:#cheight#px;'><span class='smdui_icon_btn fa-#icon#' style='max-width:#cheight#px;'></span>#label#</button>",
		iconButton:"<button type='button' class='smdui_img_btn_abs smduitype_base' style='width:100%;'><span class='smdui_icon fa-#icon#'></span> #label#</button>",
		iconTop:"<button type='button' class='smdui_img_btn_top' style='width:100%;top:4px;text-align:center;'><span class='smdui_icon fa-#icon#'></span><div class='smdui_img_btn_text'>#label#</div></button>",
		iconButtonTop:"<button type='button' class='smdui_img_btn_abs smdui_img_btn_abs_top smduitype_base' style='width:100%;top:0px;text-align:center;'><span class='smdui_icon fa-#icon#'></span><div class='smdui_img_btn_text'>#label#</div></button>"

	},
	_findAllInputs: function(){
		var result = [];
		var tagNames = ["input","select","textarea","button"];
		for(var i=0; i< tagNames.length; i++){
			var inputs = this.$view.getElementsByTagName(tagNames[i]);
			for(var j = 0; j< inputs.length; j++){
				result.push(inputs[j]);
			}
		}
		return result;
	},
	disable: function(){
        var i, node,
	        elem = this._getBox();
    	smdui.ui.baseview.prototype.disable.apply(this, arguments);
		if(elem && elem.className.indexOf(" smdui_disabled_box")== -1){
			elem.className += " smdui_disabled_box";
			var inputs = this._findAllInputs();
			for(i=0; i< inputs.length; i++)
				inputs[i].setAttribute("disabled",true);

			// richselect and based on it
			node = this.getInputNode();
			if(node && node.tagName.toLowerCase() == "div"){
				this._disabledTabIndex = node.getAttribute("tabIndex");
				node.removeAttribute("tabIndex");
			}

			if(this._settings.labelPosition == "top"){
				var label = this._dataobj.firstChild;
				if(label)
					label.className += " smdui_disabled_top_label";
			}
		}
	},
	enable: function(){
		smdui.ui.baseview.prototype.enable.apply(this, arguments);
		var node,
			elem = this._getBox();
		if(elem){
			elem.className = elem.className.replace(" smdui_disabled_box","");
			var inputs = this._findAllInputs();
			for(var i=0; i< inputs.length; i++)
				inputs[i].removeAttribute("disabled");

			node = this.getInputNode();
			if(node && !smdui.isUndefined(this._disabledTabIndex))
				node.setAttribute("tabIndex",this._disabledTabIndex);

			if(this._settings.labelPosition == "top"){
				var label = this._dataobj.firstChild;
				if(label)
					label.className = label.className.replace(" smdui_disabled_top_label","");
			}
		}
	},
	$setSize:function(x,y){
		if(smdui.ui.view.prototype.$setSize.call(this,x,y)){
			this.render();
		}
	},
	setValue:function(value){
		value = this.$prepareValue(value);
		var oldvalue = this._settings.value;
		
		if (this.$compareValue(oldvalue, value)) return false;
		
		this._settings.value = value;
		if (this._rendered_input)
			this.$setValue(value);

		this.callEvent("onChange", [value, oldvalue]);
	},
	$compareValue:function(oldvalue, value){ return oldvalue == value; },
	$prepareValue:function(value){ return this._pattern(value, false); },
	_pattern :function(value){ return value; },
	//visual part of setValue
	$setValue:function(value){
//		this._settings.label = value;
		(this.getInputNode()||{}).value = value;
	},
	getValue:function(){
		//if button was rendered - returning actual value
		//otherwise - returning last set value
		var value = this._rendered_input? this.$getValue() : this._settings.value;
		return (typeof value == "undefined") ? "" : value;
	},
	$getValue:function(){
		return this._settings.value||"";	
	},
	focus:function(){
		if(!this._settings.disabled){
			var input = this.getInputNode();
			if (input && input.focus) input.focus();
		}

	},
	blur:function() {
		var input = this.getInputNode();
		if (input && input.blur) input.blur();
	},
	//get input element
	getInputNode: function() {
		return this._dataobj.getElementsByTagName('input')[0]||this._dataobj.getElementsByTagName('button')[0];
	},
	//get top-level sub-container
	_getBox:function(){
		for(var i=0;i< this._dataobj.childNodes.length;i++){
			if(this._dataobj.childNodes[i].className.indexOf("smdui_el_box")>=0)
				return this._dataobj.childNodes[i];
		}
		return null;
	},
	_sqrt_2:Math.sqrt(2),
	_set_inner_size_next:function(){
		var cfg = this._settings;
		var arrow = this._getBox().childNodes[1];
		var button = arrow.previousSibling;
		var style = cfg.type == "next"?"right":"left";
		var height = cfg.aheight-smdui.skin.$active.inputPadding*2-2*this._borderWidth; //-2 - borders

		var arrowEdge = height*this._sqrt_2/2;
		arrow.style.width = arrowEdge+"px";
		arrow.style.height = arrowEdge+"px";
		arrow.style.top = (height - arrowEdge)/2 + smdui.skin.$active.inputPadding+ "px";
		arrow.style[style] = (height - arrowEdge)/2 +this._sqrt_2/2+ "px";
		button.style.width = cfg.awidth - height/2 -2  + "px";
		button.style.height = height + 2 + "px";
		button.style[style] =  height/2 + 2 + "px";
		button.style.top = smdui.skin.$active.inputPadding+ "px";

	},
	_calc_size:function(config){
		config = config || this._settings;
		if (config.autowidth)
			config.width = smdui.html.getTextSize((config.value||config.label), "smduibutton").width +
				(config.badge ? 15 : 0) +
				(config.type === "iconButton" ? 30 : 0) +
				(config.type === "icon"? 20 : 0);
	},
	_calck_input_size:function(){
		//use width for both width and inputWidth settings in clever way
		//in form, we can define width for some element smaller than for siblings
		//it will use inputWidth to render the desired view
		this._input_width = this._settings.inputWidth || 
			((this._content_width - this._settings.width > 2)?this._settings.width:0) || this._content_width;
		this._input_height = this._settings.inputHeight||this._inputHeight||0;
	},
	resize: function(){
		this._calc_size();
		return smdui.ui.view.prototype.resize.apply(this,arguments);
	},
	render:function(){
		this._calck_input_size();
		this._settings.awidth  = this._input_width||this._content_width;
		this._settings.aheight = this._input_height||this._content_height;

		//image button - image width
		this._settings.bheight = this._settings.aheight+2;
		this._settings.cheight = this._settings.aheight- 2*smdui.skin.$active.inputPadding;
		this._settings.dheight = this._settings.cheight - 2; // - borders

		if(smdui.AtomRender.render.call(this)){
			this._rendered_input = true;
			if (this._set_inner_size) this._set_inner_size();
			if (this._settings.align){
				var handle = this._dataobj.firstChild;
				if (this._settings.labelPosition == "top" && handle.nextSibling)
					handle = handle.nextSibling;

				switch(this._settings.align){
					case "right":
						handle.style.cssFloat = "right";
						break;
					case "center":
						handle.style.display = "inline-block";
						handle.parentNode.style.textAlign = "center";
						break;
					case "middle":
						handle.style.marginTop = Math.round((this._content_height-this._input_height)/2)+"px";
						break;
					case "bottom": 
						handle.style.marginTop = (this._content_height-this._input_height)+"px";
						break;
					case "left":
						handle.style.cssFloat = "left";
						break;
					default:
						smdui.assert(false, "Unknown align mode: "+this._settings.align);
						break;
				}
			}

			if (this.$render)
				this.$render(this.data);

			if (this._settings.disabled)
				this.disable();

			// set tooltip after render
			if (this._settings.tooltip)
				this.define("tooltip",this._settings.tooltip );

			if (this._init_once){
				this._init_once(this.data);
				this._init_once = 0;
			}
		}
	},

	refresh:function(){ this.render(); },

	on_click:{
		_handle_tab_click: function(ev, button){
			var id = smdui.html.locate(ev, "button_id");
			if (id && this.callEvent("onBeforeTabClick", [id, ev])){
				this.setValue(id);
				this.callEvent("onAfterTabClick", [id, ev]);
			}
		},
		smdui_all_segments:function(ev, button){
			this.on_click._handle_tab_click.call(this, ev, button);
		},
		smdui_all_tabs:function(ev, button) {
			this.on_click._handle_tab_click.call(this, ev, button);
		},
		smdui_inp_counter_next:function(e, obj, node){
			if (!this._settings.readonly)
				this.next();
		},
		smdui_inp_counter_prev:function(e, obj, node){
			if (!this._settings.readonly)
				this.prev();
		},
		smdui_inp_combo:function(e, obj, node){
			node.focus();
		},
		smdui_inp_checkbox_border: function(e, obj, node) {
			if (!this._settings.disabled && (e.target||e.srcElement).tagName != "DIV" && !this._settings.readonly)
				this.toggle();
		},
		smdui_inp_checkbox_label: function(e, obj, node) {
			if (!this._settings.readonly)
				this.toggle();
		},
		smdui_inp_radio_border: function(e, obj, node) {
			var value = smdui.html.locate(e, "radio_id");
			this.setValue(value);
		},
		smdui_inp_radio_label: function(e, obj, node) {
			node = node.parentNode.getElementsByTagName('input')[0];
			return this.on_click.smdui_inp_radio_border.call(this, node, obj, node);
		},
		smdui_tab_more_icon: function(ev,obj, node){
			this.getPopup().resize();
			this.getPopup().show(node,null,true);
		},
		smdui_tab_close:function(ev, obj, node){
			var id = smdui.html.locate(ev, "button_id");
            if (id && this.callEvent("onBeforeTabClose", [id, ev]))
			    this.removeOption(id);
		}
	},

	//method do not used by button, but  used by other child-views
	_check_options:function(opts){
		smdui.assert(opts, this.name+": options not defined");
		for(var i=0;i<opts.length;i++){
			//FIXME: asserts need to be removed in final version			
			smdui.assert(!opts[i].text, "Please replace .text with .value in control config");
			smdui.assert(!opts[i].label, "Please replace .label with .value in control config");

			if(typeof opts[i]=="string"){
				opts[i] = {id:opts[i], value:opts[i]};
			}
			else {
				if(smdui.isUndefined(opts[i].id))
					opts[i].id = opts[i].value;

				if(smdui.isUndefined(opts[i].value))
					opts[i].value = opts[i].id;
			}
		}
		return opts;
	},
	_get_div_placeholder: function(obj){
		var placeholder = (obj?obj.placeholder:this._settings.placeholder);
		return (placeholder?"<span class='smdui_placeholder'>"+placeholder+"</span>":"");
	}
}, smdui.ui.view, smdui.AtomRender, smdui.Settings, smdui.EventSystem);

smdui.protoUI({
	name:"label",
	defaults:{
		template:"<div style='height:100%;line-height:#cheight#px'>#label#</div>"
	},
	$skin:function(){
		this.defaults.height = smdui.skin.$active.inputHeight;
	},
	focus:function(){ return false; },
	_getBox:function(){
		return this._dataobj.firstChild;
	},
	setHTML:function(html){
		this._settings.template = function(){ return html; };
		this.refresh();
	},
	setValue: function(value){
		this._settings.label = value;
		smdui.ui.button.prototype.setValue.apply(this,arguments);
	},
	$setValue:function(value){
		this._dataobj.firstChild.innerHTML = value;
	},
	_set_inner_size:function(){}
}, smdui.ui.button);

smdui.protoUI({
	name:"icon",
	$skin:function(){
		this.defaults.height = smdui.skin.$active.inputHeight;
	},
	defaults:{
		template:function(obj){
			return "<button type='button' "+" style='height:100%;width:100%;' class='smdui_icon_button'><span class='smdui_icon fa-"+obj.icon+" '></span>"+
				(obj.badge ? "<span class='smdui_badge'>"+obj.badge+"</span>":"")+
				"</button>";
		},
		width:33
	},
	_set_inner_size:function(){
		
	}
}, smdui.ui.button);

smdui.protoUI({
	name:"text",
	_allowsClear:true,
	_init_onchange:function(){
		if (this._allowsClear){
			//define event id to prevent memory leak
			smdui._event(this.getInputNode(),"change",this._applyChanges,{bind:this});
			if (this._settings.suggest)
		   		smdui.$$(this._settings.suggest).linkInput(this);
		 }
	},
	_applyChanges: function(){
		var newvalue = this.getValue();

		if (newvalue != this._settings.value)
			this.setValue(newvalue, true);
	},
	$skin:function(){
		this.defaults.height = smdui.skin.$active.inputHeight;
		this.defaults.inputPadding = smdui.skin.$active.inputPadding;
		this._inputSpacing = smdui.skin.$active.inputSpacing;
	},
	$init:function(config){
		if (config.labelPosition == "top")
			if (smdui.isUndefined(config.height) && this.defaults.height)  // textarea
				config.height = this.defaults.height + this._labelTopHeight;

		//suggest reference for destructor
		this._destroy_with_me = [];

		this.attachEvent("onAfterRender", this._init_onchange);
		this.attachEvent("onBlur", function(){
			if(this._onBlur) this._onBlur();
		});
	},
	$renderIcon:function(){
		var config = this._settings;
		if (config.icon){
			var height = config.aheight - 2*config.inputPadding,
				padding = (height - 18)/2 -1,
				aria = this.addSection ? "role='button' tabindex='0' aria-label='"+(smdui.i18n.aria["multitext"+(config.mode || "")+"Section"])+"'": "";
				return "<span style='height:"+(height-padding)+"px;padding-top:"+padding+"px;' class='smdui_input_icon fa-"+config.icon+"' "+aria+"></span>";
			}
			return "";
	},
	relatedView_setter:function(value){
		this.attachEvent("onChange", function(){
			var value = this.getValue();
			var mode = this._settings.relatedAction;
			var viewid = this._settings.relatedView;
			var view = smdui.$$(viewid);
			if (!view){
				var top = this.getTopParentView();
				if (top && top.$$)
					view = top.$$(viewid);
			}

			smdui.assert(view, "Invalid relatedView: "+viewid);

			if (mode == "enable"){
				if (value) view.enable(); else view.disable();
			} else {
				if (value) view.show(); else view.hide();
			}
		});
		return value;
	},
	validateEvent_setter:function(value){
		if (value == "blur")
			this.attachEvent("onBlur", this.validate);

		if (value == "key")
			this.attachEvent("onTimedKeyPress", this.validate);

		return value;
	},
	validate:function(){
		var rule = this._settings.validate;
		if (!rule && this._settings.required)
			rule = smdui.rules.isNotEmpty;

		var form =this.getFormView();
		var name = this._settings.name;
		var value = this.getValue();
		var data = {}; data[name] = value;

		smdui.assert(form, "Validation works only for fields in the form");
		smdui.assert(name, "Validation works only for fields with name");

		if (rule && !form._validate(rule, value, data, name))
			return false;
		return true;
	},
	bottomLabel_setter: function(value){
		if(!this._settings.bottomPadding)
			this._settings.bottomPadding = 18;
		return value;
	},
	_getInvalidText: function(){
		var text = this._settings.invalidMessage;
		if(typeof text == "function"){
			text.call(this);
		}
		return text;
	},
	setBottomText: function(text, height){
		var config = this._settings;
		if (typeof text != "undefined"){
			if (config.bottomLabel == text) return;
			config.bottomLabel = text;
		}

		var message = (config.invalid ? config.invalidMessage : "" ) || config.bottomLabel;
		if (!message && !config.bottomPadding)
			config.inputHeight = 0;
		if (message && !config.bottomPadding){
			this._restorePadding = 1;
			config.bottomPadding = config.bottomPadding || height || 18;	
			this.render();
			this.resize();
		} else if (!message && this._restorePadding){
			config.bottomPadding = this._restorePadding = 0;
			//textarea
			if (!config.height)
				this.render();
			this.resize();
		} else
			this.render();
	},
	$getSize: function(){
		var sizes = smdui.ui.view.prototype.$getSize.apply(this,arguments);
		var heightInc = this.config.bottomPadding;
		if(heightInc){
			sizes[2] += heightInc;
			sizes[3] += heightInc;
		}
		return sizes;
	},
	$setSize:function(x,y){
		var config = this._settings;

		if(smdui.ui.view.prototype.$setSize.call(this,x,y)){
			if (!x || !y) return;

			if (config.labelPosition == "top"){
				// textarea
				if (!config.inputHeight)
					this._inputHeight = this._content_height - this._labelTopHeight - (this.config.bottomPadding||0);
				config.labelWidth = 0;
			} else if (config.bottomPadding){
				config.inputHeight = this._content_height - this.config.bottomPadding;
			}
			this.render();
		}
	},
	_get_input_width: function(config){
		var width = (this._input_width||0)-(config.label?this._settings.labelWidth:0) - this._inputSpacing - (config.iconWidth || 0);

		//prevent js error in IE
		return (width < 0)?0:width;
	},
	_render_div_block:function(obj, common){
		var id = "x"+smdui.uid();
		var width = common._get_input_width(obj);
		var inputAlign = obj.inputAlign || "left";
		var icon = this.$renderIcon?this.$renderIcon(obj):"";
		var height = this._settings.aheight - 2*smdui.skin.$active.inputPadding -2*this._borderWidth;
		var text = (obj.text||obj.value||this._get_div_placeholder(obj));
		var html = "<div class='smdui_inp_static' role='combobox' aria-label='"+smdui.template.escape(obj.label)+"' tabindex='0'"+(obj.readonly?" aria-readonly='true'":"")+(obj.invalid?"aria-invalid='true'":"")+" onclick='' style='line-height:"+height+"px;width: " + width + "px; text-align: " + inputAlign + ";' >"+ text +"</div>";
		return common.$renderInput(obj, html, id);
	},
	_baseInputHTML:function(tag){
		var html = "<"+tag+(this._settings.placeholder?" placeholder='"+this._settings.placeholder+"' ":" ");
		if (this._settings.readonly)
			html += "readonly='true' aria-readonly=''";
		if(this._settings.required)
			html += "aria-required='true'";
		if(this._settings.invalid)
			html += "aria-invalid='true'";

		var attrs = this._settings.attributes;
		if (attrs)
			for(var prop in attrs)
				html += prop+"='"+attrs[prop]+"' ";
		return html;
	},
	$renderLabel: function(config, id){
		var labelAlign = (config.labelAlign||"left");
		var top = this._settings.labelPosition == "top";
		var labelTop =  top?"display:block;":("width: " + this._settings.labelWidth + "px;");
		var label = "";
		var labelHeight = top?this._labelTopHeight-2*this._borderWidth:( this._settings.aheight - 2*this._settings.inputPadding);
		if (config.label)
			label = "<label style='"+labelTop+"text-align: " + labelAlign + ";line-height:"+labelHeight+"px;' onclick='' for='"+id+"' class='smdui_inp_"+(top?"top_":"")+"label "+(config.required?"smdui_required":"")+"'>" + (config.label||"") + "</label>";
		return label;
	},
	$renderInput: function(config, div_start, id) {
		var inputAlign = (config.inputAlign||"left");
		var top = (config.labelPosition == "top");
		var inputWidth = this._get_input_width(config);

		id = id||smdui.uid();

		var label = this.$renderLabel(config,id);

		var html = "";
		if(div_start){
			html += div_start;
		} else {
			var value =  smdui.template.escape(config.text || this._pattern(config.value)|| ( config.value ===0 ?"0":"") );
			html += this._baseInputHTML("input")+"id='" + id + "' type='"+(config.type||this.name)+"'"+(config.editable?" role='combobox'":"")+" value='" + value + "' style='width: " + inputWidth + "px; text-align: " + inputAlign + ";'";
			var attrs = config.attributes;
			if (attrs)
				for(var prop in attrs)
					html += " "+prop+"='"+attrs[prop]+"'";
			html += " />";
		}
		var icon = this.$renderIcon?this.$renderIcon(config):"";
		html += icon;

		var result = "";
		//label position, top or left
		if (top)
			result = label+"<div class='smdui_el_box' style='width:"+config.awidth+"px; height:"+config.aheight+"px'>"+html+"</div>";
		else
			result = "<div class='smdui_el_box' style='width:"+config.awidth+"px; height:"+config.aheight+"px'>"+label+html+"</div>";


		//bottom message width
		var padding = config.awidth-inputWidth-smdui.skin.$active.inputPadding*2;
		//bottom message text
		var message = (config.invalid ? config.invalidMessage : "") || config.bottomLabel;
		if (message)
			result +=  "<div class='smdui_inp_bottom_label'"+(config.invalid?"role='alert' aria-relevant='all'":"")+" style='width:"+(inputWidth||config.awidth)+"px;margin-left:"+Math.max(padding,smdui.skin.$active.inputPadding)+"px;'>"+message+"</div>";

		return result;
	},
	defaults:{
		template:function(obj, common){
			return common.$renderInput(obj);
		},
		label:"",
		labelWidth:80
	},
	type_setter:function(value){ return value; },
	_set_inner_size:false,
	$setValue:function(value){
		this.getInputNode().value = this._pattern(value);
	},
	$getValue:function(){
		return this._pattern(this.getInputNode().value, false);
	},
	suggest_setter:function(value){
		if (value){
			smdui.assert(value !== true, "suggest options can't be set as true, data need to be provided instead");

			if (typeof value == "string"){
				var attempt = smdui.$$(value);
				if (attempt) 
					return smdui.$$(value)._settings.id;

				value = { body: { url:value , dataFeed :value } };
			} else if (smdui.isArray(value))
				value = { body: { data: this._check_options(value) } };
			else if (!value.body)
				value.body = {};

			smdui.extend(value, { view:"suggest" });

			var view = smdui.ui(value);
			this._destroy_with_me.push(view);
			return view._settings.id;
		}
		return false;
	}
}, smdui.ui.button);

smdui.protoUI({
	name:"segmented",
	_allowsClear:false,
	$init:function(){
		this.attachEvent("onChange", function(value){
			if (this._settings.multiview)
				this._show_view(value);
		});
		this.attachEvent("onAfterRender", smdui.once(function(){
			if (this._settings.multiview && this._settings.value)
				this._show_view(this._settings.value);
		}));
	},
	_show_view:function(value){
		var top = this.getTopParentView();
		var view = null;

		//get from local isolate
		if (top && top.$$)
			view = top.$$(value);
		//or check globally
		if (!view)
			view = smdui.$$(value);

		if(view && view.show)
			view.show();
	},
	defaults:{
		template:function(obj, common){
			if(!obj.options)
				smdui.assert(false, "segmented: options undefined");
			var options = obj.options;
			common._check_options(options);
			options = common._filterOptions(options);

			var width = common._get_input_width(obj);

			var id = smdui.uid();
			var html = "<div style='width:"+width+"px' class='smdui_all_segments' role='tablist' aria-label='"+smdui.template.escape(obj.label)+"'>";
			var optionWidth = obj.optionWidth || Math.floor(width/options.length);
			if(!obj.value)
				obj.value = options[0].id;

			for(var i=0; i<options.length; i++){
				html+="<button type='button' style='width:"+(options[i].width || optionWidth)+"px' role='tab' aria-selected='"+(obj.value==options[i].id?"true":"false")+"' tabindex='"+(obj.value==options[i].id?"0":"-1")+"'";
				html+="class='"+"smdui_segment_"+((i==options.length-1)?"N":(i>0?1:0))+((obj.value==options[i].id)?" smdui_selected ":"")+"' button_id='"+options[i].id+"' >";
				html+= options[i].value+"</button>";
			}
			
			return common.$renderInput(obj, html+"</div>", id);
		}
	},
	_getInputNode:function(){
		return this.$view.getElementsByTagName("BUTTON");
	},
	focus: function(){ this._focus(); },
	blur: function(){ this._blur(); },
	$setValue:function(value){

		var options = this._getInputNode();

		for(var i=0; i<options.length; i++){
			var id = options[i].getAttribute("button_id");
			options[i].setAttribute("aria-selected", (value==id?"true":"false"));
			options[i].setAttribute("tabindex", (value==id?"0":"-1"));
			if(value==id)
				smdui.html.addCss(options[i], "smdui_selected");
			else
				smdui.html.removeCss(options[i], "smdui_selected");
		}
	},
	getValue:function(){
		return this._settings.value;
	},
	getInputNode:function(){
		return null;
	},
	optionIndex:function(id){
		var pages = this._settings.options;
		for (var i=0; i<pages.length; i++)
			if (pages[i].id == id)
				return i;
		return -1;
	},
	addOption:function(id, value, show, index){
		var obj = id;
		if (typeof id != "object"){
			value = value || id;
			obj = { id:id, value:value };
		} else {
			id = obj.id;
			index = show;
			show = value;
		}

		if (this.optionIndex(id) < 0)
			smdui.PowerArray.insertAt.call(this._settings.options, obj, index);
		this.refresh();

		if (show)
			this.setValue(id);
	},
	removeOption:function(id, value){
		var index = this.optionIndex(id);
		var options = this._settings.options;

		if (index >= 0)
			smdui.PowerArray.removeAt.call(options, index);

		// if we remove a selected option
		if(this._settings.value == id)
			this._setNextVisible(options, index);
			
        this.callEvent("onOptionRemove", [id, this._settings.value]);
		this.refresh();

	},
	_setNextVisible: function(options, index){
		var size = options.length;

		if(size){
			index = Math.min(index, size-1);
			//forward search
			for (var i=index; i<size; i++)
				if (!options[i].hidden)
					return this.setValue(options[i].id);
			//backward search
			for (var i=index; i>=0; i--)
				if (!options[i].hidden)
					return this.setValue(options[i].id);
		}
		
		//nothing found		
		this.setValue("");
	},
	_filterOptions: function(options){
		var copy = [];
		for(var i=0; i<options.length;i++)
			if(!options[i].hidden)
				copy.push(options[i]);
		return copy;
	},
	_setOptionVisibility: function(id, state){
		var options = this._settings.options;
		var index = this.optionIndex(id);
		var option = options[index];
		if (option && state == !!option.hidden){  //new state differs from previous one
			option.hidden = !state;
			if (state || this._settings.value != id){ 	//show item, no need for extra steps
				this.refresh();
			} else {									//hide item, switch to next visible one
				this._setNextVisible(options, index);
			}
		}
	},
	hideOption: function(id){
		this._setOptionVisibility(id,false);
	},
	showOption: function(id){
		this._setOptionVisibility(id,true);
	},
	_set_inner_size:false
}, smdui.HTMLOptions, smdui.ui.text);

smdui.protoUI({
	name:"search",
	$skin:function(){
		this.defaults.inputPadding = smdui.skin.$active.inputPadding;
	},
	on_click:{
		"smdui_input_icon":function(e){
			return this.callEvent("onSearchIconClick", [e]);
		}
	},
	defaults:{
		type:"text",
		icon:"search"
	}
}, smdui.ui.text);

smdui.protoUI({
	name:"toggle",
	_allowsClear:true,
	$init:function(){
		this.attachEvent("onItemClick", function(){
			this.toggle();
		});
	},
	$setValue:function(value){
		var input = this.getInputNode();
		var obj = this._settings;
		var isPressed = (value && value != "0");
		var text = (isPressed ? obj.onLabel : obj.offLabel) || obj.label;
		
		input.setAttribute("aria-pressed", isPressed?"true":false);
		input.value = text;
		if (input.lastChild)
			input.lastChild.nodeValue = " "+text;

		//icon or image button
		if(input.firstChild && input.firstChild.nodeName ==="SPAN" && obj.onIcon && obj.offIcon && obj.onIcon !==obj.offIcon)
			input.firstChild.className = input.firstChild.className.replace((isPressed?obj.offIcon:obj.onIcon),  (isPressed?obj.onIcon:obj.offIcon));
		
		var parent = input.parentNode;
		if(isPressed)
			smdui.html.addCss(parent, "smdui_pressed");
		else
			smdui.html.removeCss(parent, "smdui_pressed");
	},
	toggle:function(){
		this.setValue(!this.getValue());
	},
	getValue:function(){
		var value = this._settings.value;
		return  (!value||value=="0")?0:1;
	},
	defaults:{
		template:function(obj, common){
			var isPressed = (obj.value && obj.value != "0");
			var css = isPressed ? " smdui_pressed" : "";

			obj.label = (isPressed ? obj.onLabel : obj.offLabel) || obj.label;
			obj.icon = (isPressed ? obj.onIcon : obj.offIcon) || obj.icon;
			var html =  "<div class='smdui_el_box"+css+"' style='width:"+obj.awidth+"px; height:"+obj.aheight+"px'>"+common.$renderInput(obj, common)+"</div>";
			html = html.replace(/(button)\s*(?=\w)/, "$1"+(" aria-pressed='"+(isPressed?"true":"false")+"' "));
			return html;
		}
	},
	_set_inner_size:false
}, smdui.ui.button);

smdui.protoUI({
	name:"select",
	defaults:{
		template:function(obj,common) {
			var options = common._check_options(obj.options);
			var id = "x"+smdui.uid();
			var html = common._baseInputHTML("select")+"id='"+id+"' style='width:"+common._get_input_width(obj)+"px;'>";

			var optview = smdui.$$(options);
            if(optview && optview.data && optview.data.each){
                optview.data.each(function(option){
                    html+="<option"+((option.id == obj.value)?" selected='true'":"")+" value='"+option.id+"'>"+option.value+"</option>";
                });
            }else
                for(var i=0; i<options.length; i++) {
                    html+="<option"+((options[i].id == obj.value)?" selected='true'":"")+" value='"+options[i].id+"'>"+options[i].value+"</option>";
                }
			html += "</select>";
			return common.$renderInput(obj, html, id);
		}
	},
    options_setter:function(value){
        if(value){
            if(typeof value =="string"){
                var collection = new smdui.DataCollection({url:value});
                collection.data.attachEvent("onStoreLoad", smdui.bind(this.refresh, this));
                return collection;
            }
            else
                return value;
        }
    },
	//get input element
	getInputNode: function() {
		return this._dataobj.getElementsByTagName('select')[0];
	}
}, smdui.ui.text);

smdui.protoUI({
	name:"textarea",
	defaults:{
		template:function(obj, common){ 
			var name = obj.name || obj.id;
			var id = "x"+smdui.uid();

			var html = common._baseInputHTML("textarea")+"style='width:"+common._get_input_width(obj)+"px;'";
			html +=" id='"+id+"' name='"+name+"' class='smdui_inp_textarea'>"+common._pattern(obj.value|| (obj.value ===0?"0":""))+"</textarea>";

			return common.$renderInput(obj, html, id);
		},
		height:0,
		minHeight:60
	},
	$skin:function(){
		this.defaults.inputPadding = smdui.skin.$active.inputPadding;
		this._inputSpacing = smdui.skin.$active.inputSpacing;
	},
	_skipSubmit: true,
	$renderLabel: function(config, id){
		var labelAlign = (config.labelAlign||"left");
		var top = this._settings.labelPosition == "top";
		var labelTop =  top?"display:block;":("width: " + this._settings.labelWidth + "px;");
		var label = "";
		var labelHeight = top?this._labelTopHeight-2*this._borderWidth:( (smdui.skin.$active.inputHeight||this._settings.aheight) - 2*this._settings.inputPadding);
		if (config.label)
			label = "<label style='"+labelTop+"text-align: " + labelAlign + ";' onclick='' for='"+id+"' class='smdui_inp_"+(top?"top_":"")+"label "+(config.required?"smdui_required":"")+"'>" + (config.label||"") + "</label>";
		return label;
	},
	//get input element
	getInputNode: function() {
		return this._dataobj.getElementsByTagName('textarea')[0];
	}
}, smdui.ui.text);

smdui.protoUI({
	name:"counter",
	defaults:{
		template:function(config, common){
			var value = (config.value||0);

			var id = "x"+smdui.uid();
			var html = "<div role='spinbutton' aria-label='"+smdui.template.escape(config.label)+"' aria-valuemin='"+config.min+"' aria-valuemax='"+config.max+"' aria-valuenow='"+config.value+"' class='smdui_el_group' style='width:"+common._get_input_width(config)+"px'>";
				html +=  "<button type='button' class='smdui_inp_counter_prev' tabindex='-1' aria-label='"+smdui.i18n.aria.decreaseValue+"'>-</button>";
				html += common._baseInputHTML("input")+" id='"+id+"' type='text' class='smdui_inp_counter_value' aria-live='assertive'"+" value='"+value+"'></input>";
				html += "<button type='button' class='smdui_inp_counter_next' tabindex='-1' aria-label='"+smdui.i18n.aria.increaseValue+"'>+</button></div>";
			return common.$renderInput(config, html, id);
		},
		min:0,
		max:Infinity,
		step:1
	},
	$init:function(){
		smdui._event(this.$view, "keydown", this._keyshift, {bind:this});
	},
	_keyshift:function(e){
		var code = e.which || e.keyCode, c = this._settings, value = c.value || c.min;

		if(code>32 && code <41){
			if(code === 35) value = c.min;
			else if(code === 36) value = c.max === Infinity? 1000000 :c.max;
			else if(code === 33) this.next();
			else if(code === 34) this.prev();
			else value = value+(code === 37 || code ===40?-1:1);
			
			if(code>34 && value>=c.min && value <=c.max)
				this.setValue(value);
		}
	},
	$setValue:function(value){
		this.getInputNode().value = value;
	},
	getInputNode:function(){
		return this._dataobj.getElementsByTagName("input")[0];
	},
	getValue:function(obj){
		return  smdui.ui.button.prototype.getValue.apply(this,arguments)*1;
	},
	next:function(step){
		step = this._settings.step;
		this.shift(step);
	},
	prev:function(step){
		step = (-1)*this._settings.step;
		this.shift(step);
	},
	shift:function(step){
		var min = this._settings.min;
		var max = this._settings.max;

		var new_value = this.getValue() + step;
		if (new_value >= min && new_value <= max)
			this.setValue(new_value);
	}
}, smdui.ui.text);

smdui.protoUI({
	name:"checkbox",
	defaults:{
		checkValue:1,
		uncheckValue:0,
		template:function(config, common) {
			var id = "x"+smdui.uid();
			var rightlabel = "";
			if (config.labelRight){
				rightlabel = "<label class='smdui_label_right'>"+config.labelRight+"</label>";
				//user clearly attempts to hide the label, help him
				if (config.labelWidth)
					config.label = config.label || "&nbsp;";
			}
			var checked = (config.checkValue == config.value);
			var margin = Math.floor((common._settings.aheight-16)/2);
			var ch = common._baseInputHTML("input")+"style='margin-top:"+margin+"px;"+(config.customCheckbox?"display:none":"")+"' id='"+id+"' type='checkbox' "+(checked?"checked='1'":"")+(config.labelRight?" aria-label='"+smdui.template.escape(config.labelRight)+"'":"")+"/>";
			var className = "smdui_inp_checkbox_border smdui_el_group smdui_checkbox_"+(checked?"1":"0");
			var customCheckbox = config.customCheckbox || "";
			if(customCheckbox){
				customCheckbox = customCheckbox.replace(/(aria-checked=')\w*(?=')/, "$1"+(config.value == config.checkValue?"true":"false"));
				customCheckbox = customCheckbox.replace(/(aria-label=')\w*(?=')/, "$1"+smdui.template.escape(config.labelRight || config.label));
				customCheckbox = customCheckbox.replace(/(aria-invalid=')\w*(?=')/, "$1"+(config.invalid?"true":"false"));
			}
			var html = "<div style='line-height:"+common._settings.cheight+"px' class='"+className+"'>"+ch+customCheckbox+rightlabel+"</div>";
			return common.$renderInput(config, html, id);
		}
	},
	customCheckbox_setter: function(value){
		if( value === true && smdui.skin.$active.customCheckbox){
			value = "<a role='presentation' onclick='javascript:void(0)'><button role='checkbox' aria-checked='false' aria-label='' type='button' aria-invalid='' class='smdui_custom_checkbox'></button></a>";
		}
		return value;
	},
	focus: function(){
		var input = this.$view.getElementsByTagName(this._settings.customCheckbox?"button":"input")[0];
		if(input)
			input.focus();
	},
	blur: function(){
		var input = this.$view.getElementsByTagName(this._settings.customCheckbox?"button":"input")[0];
		if(input)
			input.blur();
	},
	_init_onchange: function(){},
	$setValue:function(value){
		var isChecked = (value == this._settings.checkValue);
		var parentNode = this.getInputNode()?this.getInputNode().parentNode:null;

		if(parentNode && this._settings.customCheckbox){
			var button = parentNode.getElementsByTagName("BUTTON");
			if(button[0]) button[0].setAttribute("aria-checked", isChecked?"true":"false");
		}
		if(parentNode){
			parentNode.className = parentNode.className.replace(/(smdui_checkbox_)\d/,"$1"+(isChecked?1:0));
		}
		this.getInputNode().checked = isChecked;
	},
	toggle:function(){
		var value = (this.getValue() != this._settings.checkValue)?this._settings.checkValue:this._settings.uncheckValue;
		this.setValue(value);
	},
	getValue:function(){
		var value = this._settings.value;
		return  (value == this._settings.checkValue)?this._settings.checkValue:this._settings.uncheckValue;
	},
	$skin:function(){
		if(smdui.skin.$active.customCheckbox)
			this.defaults.customCheckbox = true;
	}
}, smdui.ui.text);

smdui.protoUI({
	name:"radio",
	defaults:{
		template: function(config,common) {
			var options = common._check_options(config.options);
			var html = [];
			var id;

			for (var i=0; i < options.length; i++) {
				var eachid = "x"+smdui.uid();
				id = id || eachid;

				if  (i && (options[i].newline || config.vertical))
					html.push("<div class='smdui_line_break'></div>");
				var isChecked = (options[i].id == config.value);
				var label = options[i].value || "";
				
				var customRadio = config.customRadio|| "";
				if(customRadio){
					var optlabel = (i === 0 ? config.label+" " : "")+label;
					customRadio = customRadio.replace(/(aria-label=')\w*(?=')/, "$1"+smdui.template.escape(optlabel));
					customRadio = customRadio.replace(/(aria-checked=')\w*(?=')/, "$1"+(isChecked?"true":"false"));
					customRadio = customRadio.replace(/(tabindex=')\w*(?=')/, "$1"+(isChecked || (i === 0 && !config.value)?"0":"-1"));
					customRadio = customRadio.replace(/(aria-invalid=')\w*(?=')/, "$1"+(config.invalid?"true":"false"));
				}
				var rd = common._baseInputHTML("input")+" name='"+(config.name || config.id)+"' type='radio' "+(isChecked?"checked='1'":"")+"tabindex="+(isChecked || (i === 0 && !config.value)?"0":"-1")+" value='"+options[i].id+"' id='"+eachid+"' style='"+(customRadio?"display:none":"")+"' />";
				var input = "<div radio_id='"+options[i].id+"' class='smdui_inp_radio_border smdui_radio_"+(isChecked?"1":"0")+"' role='presentation'>"+rd+customRadio+"</div>";
				if (label)
					label = "<label for='"+eachid+"' class='smdui_label_right'>" + label + "</label>";

				html.push("<div class='smdui_radio_option' role='presentation'>"+input + label+"</div>");
				
			}
			html = "<div class='smdui_el_group' role='radiogroup' style='margin-left:"+(config.label?config.labelWidth:0)+"px;'>"+html.join("")+"</div>";
			
			return common.$renderInput(config, html, id);
		}
	},
	refresh:function(){
		this.render();
		if (this._last_size && this.$getSize(0,0)[2] != this._last_size[1])
			this.resize();
	},
	$getSize:function(dx, dy){
		var size = smdui.ui.button.prototype.$getSize.call(this, dx, dy);
		if (this._settings.options){
			var count = this._settings.vertical?0:1;
			for (var i=0; i < this._settings.options.length; i++)
				if (this._settings.vertical || this._settings.options[i].newline)
					count++;
			size[3] = size[2] = Math.max(size[2], (this._settings.optionHeight||25) * count+this._settings.inputPadding*2+ (this._settings.labelPosition == "top"?this._labelTopHeight:0));
		}
		var heightInc = this.config.bottomPadding;
		if(heightInc){
			size[2] += heightInc;
			size[3] += heightInc;
		}
		return size;
	},
	_getInputNode: function(){
		return this._dataobj.getElementsByTagName('input');
	},
	$setValue:function(value){
		var inp = this._getInputNode();

		for (var i=0; i < inp.length; i++){
			if (inp[i].parentNode.getAttribute("radio_id")==value){
				inp[i].className = "smdui_inp_radio_on";	
				inp[i].checked = true;
				inp[i].setAttribute("tabindex","0");
			} else{
				inp[i].className = "smdui_inp_radio_on smdui_hidden";
				inp[i].checked = false;
				inp[i].setAttribute("tabindex","-1");
			}
			var parentNode = inp[i]?inp[i].parentNode:null;

			if(parentNode){
				parentNode.className = parentNode.className.replace(/(smdui_radio_)\d/,"$1"+(inp[i].checked?1:0));
				if(this._settings.customRadio){
					var button = parentNode.getElementsByTagName("BUTTON");
					if(button[0]){
						button[0].setAttribute("aria-checked", inp[i].checked?"true":"false");
						button[0].setAttribute("tabindex", inp[i].checked?"0":"-1");
					}
				}
			}
		}
	},
	getValue:function(obj){
		return this._settings.value;
	},
	focus: function(){ this._focus(); },
	blur: function(){ this._blur(); },
	customRadio_setter: function(value){
		if(value === true && smdui.skin.$active.customRadio)
			value = "<a role='presentation' onclick='javascript:void(0)'><button type='button' class='smdui_custom_radio' role='radio' aria-checked='false' aria-label='' aria-invalid='' tabindex=''></button></a>";
		return value;
	},
	$skin:function(){
		if(smdui.skin.$active.customRadio)
			this.defaults.customRadio = true;
		if(smdui.skin.$active.optionHeight)
			this.defaults.optionHeight = smdui.skin.$active.optionHeight;
	}
}, smdui.HTMLOptions, smdui.ui.text);

smdui.protoUI({
	name:"richselect",
	defaults:{
		template:function(obj,common){
			return common._render_div_block(obj, common);
		},
		popupWidth:200,
		icon: "angle-down"
	},
	_onBlur:function(){
		if (this._settings.text == this.getText() || (smdui.isUndefined(this._settings.text) && !this.getText()))
			return;

		var suggest =  this.getPopup(),
			value = suggest.getSuggestion();

		if (value && !(this.getInputNode().value==="" && suggest.getItemText(value)!==""))
			this.setValue(value);
		else if(this._revertValue)
			this._revertValue();
	},
	suggest_setter:function(value){
		return this.options_setter(value);
	},
	options_setter:function(value){
		value = this._suggest_config ? this._suggest_config(value) : value;
		var suggest = (this._settings.popup = this._settings.suggest = smdui.ui.text.prototype.suggest_setter.call(this, value));
		var list = smdui.$$(suggest).getList();
		if (list)
			list.attachEvent("onAfterLoad", smdui.bind(this._reset_value, this));

		return suggest;
	},
	getList: function(){
		var suggest = smdui.$$(this._settings.suggest);
		smdui.assert(suggest, "Input doesn't have a list");
		return suggest.getList();
	},
	_reset_value:function(){
		var value = this._settings.value;
		//this._dataobj.firstChild - check that input is already rendered, as in IE11 it can be destroy during parent repainting
		if(!smdui.isUndefined(value) && !this.getPopup().isVisible() && !this._settings.text && this._dataobj.firstChild)
			this.$setValue(value);
	},
	$skin:function(){
		this.defaults.inputPadding = smdui.skin.$active.inputPadding;
	},
	$render:function(obj){
		if (smdui.isUndefined(obj.value)) return;
		this.$setValue(obj.value);
	},
	getInputNode: function(){
		return this._dataobj.getElementsByTagName("DIV")[1];
	},
	getPopup: function(){
	 	return smdui.$$(this._settings.popup);
	},
	getText:function(){
		var value = this._settings.value,
			node = this.getInputNode();
		if(!node)
			return value?this.getPopup().getItemText(value):"";
		return typeof node.value == "undefined" ? (this.getValue()?node.innerHTML:"") : node.value;
	},
	$setValue:function(value){
		if (!this._rendered_input) return;

		var text = value;
		var popup = this.getPopup();

		if (popup)
			var text = this.getPopup().getItemText(value);

		if (!text && value && value.id){ //add new value
			this.getPopup().getList().add(value);
			text = this.getPopup().getItemText(value.id);
			this._settings.value = value.id;
		}

		var node = this.getInputNode();

		if (smdui.isUndefined(node.value))
			node.innerHTML = text || this._get_div_placeholder();
		else 
			node.value = text = text.replace(/<[^>]*>/g,"");

		this._settings.text = text;
	},
	getValue:function(){
		return this._settings.value||"";
	}
}, smdui.ui.text);

smdui.protoUI({
	name:"combo",
	getInputNode:function(){
		return this._dataobj.getElementsByTagName('input')[0];
	},
	$render:function(obj){
		if (smdui.isUndefined(obj.value)) return;
		this.$setValue(obj.value);
	},
	_revertValue:function(){
		if(!this._settings.editable){
			var value = this.getValue();
			this.$setValue(smdui.isUndefined(value)?"":value);
		}
	},
	_applyChanges:function(){
		var input = this.getInputNode(),
			value = "",
			suggest =  this.getPopup();

		if (input.value){
			value = this._settings.value;
			if(suggest.getItemText(value) != this.getText())
				value = suggest.getSuggestion()||value;
		}
		if (value != this._settings.value)
			this.setValue(value, true);
		else
			this.$setValue(value);
	},
	defaults:{
		template:function(config, common){
			return common.$renderInput(config).replace(/(<input)\s*(?=\w)/, "$1"+" role='combobox'");
		},
		icon: "angle-down"
	}
}, smdui.ui.richselect);


smdui.protoUI({
	name:"datepicker",
	$init:function(){
		this.$ready.push(this._init_popup);
	},
	defaults:{
		template:function(obj, common){
			if(common._settings.type == "time"){
				common._settings.icon = common._settings.timeIcon;
			}
			//temporary remove obj.type [[DIRTY]]
			var t = obj.type; obj.type = "";
			var res = obj.editable?common.$renderInput(obj):common._render_div_block(obj, common);
			obj.type = t;
			return res;
		},
		stringResult:false,
		timepicker:false,
		icon:"calendar",
		icons: true,
		timeIcon: "clock-o"
	},
	_onBlur:function(){
		if (this._settings.text == this.getText() || (smdui.isUndefined(this._settings.text) && !this.getText()))
			return;

		var value = this.getPopup().getValue();
		if (value)
			this.setValue(value);
	},
	$skin:function(){
		this.defaults.inputPadding = smdui.skin.$active.inputPadding;
	},
	getPopup: function(){
	 	return smdui.$$(this._settings.popup);
	},
	_init_popup:function(){ 
		var obj = this._settings;
		if (obj.suggest)
			obj.popup = obj.suggest;
		else if (!obj.popup){
			var timepicker = this._settings.timepicker;
			obj.popup = obj.suggest = this.suggest_setter({
				type:"calendar", height:240+(timepicker?30:0), width:250, padding:0,
				body: { timepicker:timepicker, type: this._settings.type, icons: this._settings.icons }
			});
		}

		this._init_once = function(){};
	},
	$render:function(obj){
		if (smdui.isUndefined(obj.value)) return;
		obj.value = this.$prepareValue(obj.value);
		this.$setValue(obj.value);
	},
	$prepareValue:function(value){
		var type = this._settings.type;
		var timeMode = type == "time";

		//setValue("1980-12-25")
		if(!isNaN(parseFloat(value)))
			value = ""+value;

		if (typeof value=="string" && value){
			var formatDate = null;
			if((type == "month" || type == "year") && this._formatDate){
				formatDate = this._formatDate;
			}
			else
				formatDate = (timeMode?smdui.i18n.parseTimeFormatDate:smdui.i18n.parseFormatDate);
			value = formatDate(value);
		}

		if (value){
			//time mode
			if(timeMode){
				//setValue([16,24])
				if(smdui.isArray(value)){
					var time = new Date();
					time.setHours(value[0]);
					time.setMinutes(value[1]);
					value = time;
				}
			}
			//setValue(invalid date)
			if(isNaN(value.getTime()))
				value = "";
		}

		return value;
	},
	_get_visible_text:function(value){
		var timeMode = this._settings.type == "time";
		var timepicker = this.config.timepicker;
		var formatStr = this._formatStr||(timeMode?smdui.i18n.timeFormatStr:(timepicker?smdui.i18n.fullDateFormatStr:smdui.i18n.dateFormatStr));
		return formatStr(value);
	},
	_set_visible_text:function(){
		var node = this.getInputNode();
		if(node.value == smdui.undefined){
			node.innerHTML = this._settings.text || this._get_div_placeholder();
		}
		else{
			node.value = this._settings.text || "";
		}
	},
	$compareValue:function(oldvalue, value){
		if(!oldvalue && !value) return true;
		return smdui.Date.equal(oldvalue, value);
	},
	$setValue:function(value){
		this._settings.text = (value?this._get_visible_text(value):"");
		this._set_visible_text();
	},
	format_setter:function(value){
		if(value){
			if (typeof value === "function")
				this._formatStr = value;
			else {
				this._formatStr = smdui.Date.dateToStr(value);
				this._formatDate = smdui.Date.strToDate(value);
			}
		}
		else
			this._formatStr = this._formatDate = null;
		return value;
	},
	getInputNode: function(){
		return this._settings.editable?this._dataobj.getElementsByTagName('input')[0]:this._dataobj.getElementsByTagName("DIV")[1];
	},
	getValue:function(){
		var type = this._settings.type;
		//time mode
		var timeMode = (type == "time");
		//date and time mode
		var timepicker = this.config.timepicker;

		var value = this._settings.value;

		//input was not rendered, we need to parse value from setValue method
		if (!this._rendered_input)
			value = this.$prepareValue(value) || null;
		//rendere and in edit mode
		else if (this._settings.editable){
			var formatDate = this._formatDate||(timeMode?smdui.i18n.timeFormatDate:(timepicker?smdui.i18n.fullDateFormatDate:smdui.i18n.dateFormatDate));
			value = formatDate(this.getInputNode().value);
		}

		//return string from getValue
		if(this._settings.stringResult){
			var formatStr =smdui.i18n.parseFormatStr;
			if(timeMode)
				formatStr = smdui.i18n.parseTimeFormatStr;
			if(this._formatStr && (type == "month" || type == "year")){
				formatStr = this._formatStr;
			}

			return (value?formatStr(value):"");
		}
		
		return value||null;
	},
	getText:function(){
		var node = this.getInputNode();
		return (node?(typeof node.value == "undefined" ? (this.getValue()?node.innerHTML:"") : node.value):"");
	}
}, smdui.ui.text);

smdui.RenderStack={
	$init:function(){
		smdui.assert(this.data,"RenderStack :: Component doesn't have DataStore");
        smdui.assert(smdui.template,"smdui.template :: smdui.template is not accessible");

		//used for temporary HTML elements
		//automatically nulified during destruction
		this._html = document.createElement("DIV");
				
		this.data.attachEvent("onIdChange", smdui.bind(this._render_change_id, this));
		this.attachEvent("onItemClick", this._call_onclick);
		
		//create copy of default type, and set it as active one
		if (!this.types){ 
			this.types = { "default" : this.type };
			this.type.name = "default";
		}

		this.type = smdui.clone(this.type);
	},
	
	customize:function(obj){ 
		smdui.type(this,obj);
	},
	item_setter:function(value){
		return this.type_setter(value);
	},
	type_setter:function(value){
		if(!this.types[value])
			this.customize(value);
		else {
			this.type = smdui.clone(this.types[value]);
			if (this.type.css) 
				this._contentobj.className+=" "+this.type.css;
		}
		if (this.type.on_click)
			smdui.extend(this.on_click, this.type.on_click);

		return value;
	},
	
	template_setter:function(value){
		this.type.template=smdui.template(value);
	},
	//convert single item to HTML text (templating)
	_toHTML:function(obj){
			var mark = this.data._marks[obj.id];
			//check if related template exist
			smdui.assert((!obj.$template || this.type["template"+obj.$template]),"RenderStack :: Unknown template: "+obj.$template);
			this.callEvent("onItemRender",[obj]);
			return this.type.templateStart(obj,this.type, mark)+(obj.$template?this.type["template"+obj.$template]:this.type.template)(obj,this.type,mark)+this.type.templateEnd(obj, this.type,mark);
	},
	//convert item to HTML object (templating)
	_toHTMLObject:function(obj){
		this._html.innerHTML = this._toHTML(obj);
		return this._html.firstChild;
	},
	_render_change_id:function(old, newid){
		var obj = this.getItemNode(old);
		if (obj) {
			obj.setAttribute(this._id, newid);
			this._htmlmap[newid] = this._htmlmap[old];
			delete this._htmlmap[old];
		}
	},
	//calls function that is set in onclick property
	_call_onclick:function(){
		if (this._settings.click){
			var code = smdui.toFunctor(this._settings.click, this.$scope);
			if (code && code.call) code.apply(this,arguments);
		}
	},
	//return html container by its ID
	//can return undefined if container doesn't exists
	getItemNode:function(search_id){
		if (this._htmlmap)
			return this._htmlmap[search_id];
			
		//fill map if it doesn't created yet
		this._htmlmap={};
		
		var t = this._dataobj.childNodes;
		for (var i=0; i < t.length; i++){
			var id = t[i].getAttribute(this._id); //get item's
			if (id)
				this._htmlmap[id]=t[i];
		}
		//call locator again, when map is filled
		return this.getItemNode(search_id);
	},
	//return id of item from html event
	locate:function(e){ return smdui.html.locate(e,this._id); },
	/*change scrolling state of top level container, so related item will be in visible part*/
	showItem:function(id){

		var html = this.getItemNode(id);
		if (html&&this.scrollTo){
			var txmin = Math.abs(this._contentobj.offsetLeft-html.offsetLeft);
			var txmax = txmin + html.offsetWidth;
			var tymin = Math.abs(this._contentobj.offsetTop-html.offsetTop);
			var tymax = tymin + html.offsetHeight;
			var state = this.getScrollState();

			var x = state.x;
			if (x > txmin || x + this._content_width < txmax )
				x = txmin;
			var y = state.y;
			if (y > tymin || y + this._content_height < tymax )
				y = tymin - 5;

			this.scrollTo(x,y);
			if(this._setItemActive)
				this._setItemActive(id);
		}
	},
	//update view after data update
	//method calls low-level rendering for related items
	//when called without parameters - all view refreshed
	render:function(id,data,type){
		if (!this.isVisible(this._settings.id) || this.$blockRender)
			return;
		
		if (smdui.debug_render)
			smdui.log("Render: "+this.name+"@"+this._settings.id+", mode:"+(type||"#")+", item:"+(id||"#"));
			
		if (id){
			var cont = this.getItemNode(id); //get html element of updated item
			switch(type){
				case "paint":
				case "update":
					//in case of update - replace existing html with updated one
					if (!cont) return;
					var t = this._htmlmap[id] = this._toHTMLObject(data);
					smdui.html.insertBefore(t, cont); 
					smdui.html.remove(cont);
					break;
				case "delete":
					//in case of delete - remove related html
					if (!cont) return;
					smdui.html.remove(cont);
					delete this._htmlmap[id];
					break;
				case "add":
					//in case of add - put new html at necessary position
					var t = this._htmlmap[id] = this._toHTMLObject(data);
					smdui.html.insertBefore(t, this.getItemNode(this.data.getNextId(id)), this._dataobj);
					break;
				case "move":
					//moving without repainting the item
					smdui.html.insertBefore(this.getItemNode(id), this.getItemNode(this.data.getNextId(id)), this._dataobj);
					break;
				default:
					smdui.assert_error("Unknown render command: "+type);
					break;
			}
		} else {
			//full reset
			if (this.callEvent("onBeforeRender",[this.data])){
				/*if (this.getScrollState)
					var scroll = this.getScrollState();*/
					
				//getRange - returns all elements
				(this._renderobj||this._dataobj).innerHTML = this.data.getRange().map(this._toHTML,this).join("");
				this._htmlmap = null; //clear map, it will be filled at first getItemNode
				this.callEvent("onAfterRender",[]);
                var t = this._dataobj.offsetHeight;
                
				/*if (this.getScrollState)
					this.scrollTo(scroll.x, scroll.y);*/
			}
		}
	}
};

smdui.ValidateData = {
	$init:function(){
		if(this._events)
			this.attachEvent("onChange",this.clearValidation);
	},
	clearValidation:function(){
		if(this.elements){
			for(var id in this.elements){
				this._clear_invalid(id);
			}
		}
	},
	validate:function(mode, obj) {
		smdui.assert(this.callEvent, "using validate for eventless object");
		
		this.callEvent("onBeforeValidate", []);
		var failed = this._validate_details = {};

		//optimistic by default :) 
		var result =true;
		var rules = this._settings.rules;
		
		var isHidden = this.isVisible && !this.isVisible();
		var validateHidden = mode && mode.hidden;
		var validateDisabled = mode && mode.disabled;

        //prevent validation of hidden elements
		var elements = {}, hidden = {};
        for(var i in this.elements){
            var name = this.elements[i].config.name;
            //we are ignoring hidden and disabled fields during validation
            //if mode doesn not instruct us otherwise
            //if form itself is hidden, we can't separate hidden fiels,
            //so we will vaidate all fields
            if((isHidden || this.elements[i].isVisible() || validateHidden) && (this.elements[i].isEnabled() || validateDisabled))
				elements[name] = this.elements[i];
            else{
				hidden[name]=true;
            }
        }
		if (rules || elements)
			if(!obj && this.getValues)
				obj = this.getValues();

		if (rules){
			//complex rule, which may chcek all properties of object
			if (rules.$obj)
				result = this._validate(rules.$obj, obj, obj, "") && result;
			
			//all - applied to all fields
			var all = rules.$all;
			var data = obj;

			if (this._settings.complexData)
				data = smdui.CodeParser.collapseNames(obj);

			if (all)
				for (var key in obj){
                    if(hidden[key]) continue;
                    var subresult = this._validate(all, data[key], obj, key);
					if (!subresult)
						failed[key] = true;
					result =  subresult && result;
				}


			//per-field rules
			for (var key in rules){
                if(hidden[key]) continue;
				if (key.indexOf("$")!==0 && !failed[key]){
					smdui.assert(rules[key], "Invalid rule for:"+key);
					var subresult = this._validate(rules[key], data[key], obj, key);
					if (!subresult)
						failed[key] = true;
					result = subresult && result;
				}
			}
		}

		//check personal validation rules
		if (elements){
			for (var key in elements){
				if (failed[key]) continue;

				var subview = elements[key];
				if (subview.validate){
					var subresult = subview.validate();
					result = subresult && result;
					if (!subresult)
						failed[key] = true;
				} else {
					var input = subview._settings;
					if (input){	//ignore non smdui inputs
						var validator = input.validate;
						if (!validator && input.required)
							validator = smdui.rules.isNotEmpty;

						if (validator){
							var subresult = this._validate(validator, obj[key], obj, key);
							if (!subresult)
								failed[key] = true;
							result = subresult && result;
						}
					}
				}
			}
		}
	
		this.callEvent("onAfterValidation", [result, this._validate_details]);
		return result;
	},
	_validate:function(rule, data, obj, key){
		if (typeof rule == "string")
			rule = smdui.rules[rule];
		if (rule.call(this, data, obj, key)){
			if(this.callEvent("onValidationSuccess",[key, obj]) && this._clear_invalid)
				this._clear_invalid(key);
			return true;
		}
		else {
			if(this.callEvent("onValidationError",[key, obj]) && this._mark_invalid)
				this._mark_invalid(key);
		}
		return false;
	}
};

smdui.ValidateCollection = {
	_validate_init_once:function(){
		this.data.attachEvent("onStoreUpdated",smdui.bind(function(id, data, mode){
			if (id && (mode == "add" || mode == "update"))
				this.validate(id);
		}, this));
		this.data.attachEvent("onClearAll",smdui.bind(this.clearValidation, this));

		this._validate_init_once = function(){};
	},
	rules_setter:function(value){
		if (value){
			this._validate_init_once();
		}
		return value;
	},
	clearValidation:function(){
		this.data.clearMark("smdui_invalid", true);
	},
	validate:function(id){
		var result = true;
		if (!id)
			for (var key in this.data.pull)
				var result = this.validate(key) && result;
		else {
			this._validate_details = {};
			var obj = this.getItem(id);
			result = smdui.ValidateData.validate.call(this, null, obj);
			if (result){
				if (this.callEvent("onValidationSuccess",[id, obj]))
					this._clear_invalid(id);
			} else {
				if (this.callEvent("onValidationError",[id, obj, this._validate_details]))
					this._mark_invalid(id, this._validate_details);
			}
		}
		return result;
	},
	_validate:function(rule, data, obj, key){
		if (typeof rule == "string")
			rule = smdui.rules[rule];

		var res = rule.call(this, data, obj, key);
		if (!res){
			this._validate_details[key] = true;
		}
		return res;
	},
	_clear_invalid:function(id){
		this.data.removeMark(id, "smdui_invalid", true);
	},
	_mark_invalid:function(id, details){
		this.data.addMark(id, "smdui_invalid", true);
	}
};


smdui.rules = {
	isEmail: function(value){
		return (/\S+@[^@\s]+\.[^@\s]+$/).test((value || "").toString());
	},
	isNumber: function(value){
		return (parseFloat(value) == value);
	},
	isChecked: function(value){
		return (!!value) || value === "0";
	},
	isNotEmpty: function(value){
		return (value === 0 || value);
	}
};
/*Data collection mapping logic */

smdui.MapCollection = {
    $init:function(){
        this.$ready.push(this._create_scheme_init);
        this.attachEvent("onStructureUpdate", this._create_scheme_init);
        this.attachEvent("onStructureLoad", function(){
            if(!this._scheme_init_order.length)
                this._create_scheme_init();
        });
    },
    _create_scheme_init:function(order){
        var order = this._scheme_init_order = [];
        var config = this._settings;

        if (config.columns)
            this._build_data_map(config.columns);
        if (this._settings.map)
            this._process_field_map(config.map);

        if (this._scheme_init_order.length){
             try {
            this.data._scheme_init = Function("obj",order.join("\n"));
            } catch(e){
                smdui.assert_error("Invalid data map:"+order.join("\n"));
            }
        }
    },
    _process_field_map:function(map){
        for (var key in map)
            this._scheme_init_order.push(this._process_single_map(key, map[key]));
    },
    _process_single_map:function(id, map, extra){
        var start = "";
        var end = "";

        if (map.indexOf("(date)")===0){
            start = "smdui.i18n.parseFormatDate("; end=")";
            if (extra && !extra.format) extra.format = smdui.i18n.dateFormatStr;
            map = map.replace("(date)","");
        } else if (map.indexOf("(number)")===0){
            start = "("; end=")*1";
            map = map.replace("(number)","");
        }

        if (map !== ""){
            map=map.replace(/\{obj\.([^}]*)\}/g,"\"+(obj.$1||'')+\"");
            map=map.replace(/#([^#'";, ]+)#/gi,"\"+(obj.$1||'')+\"");
        } else
            map = "\"+(obj."+id+"||'')+\"";


        return "obj."+id+" = "+start+'"'+map+'"'+end+";";
    },
    _build_data_map:function(columns){ //for datatable
        for (var i=0; i<columns.length; i++){
            var map = columns[i].map;
            var id = columns[i].id;
            if (!id) {
                id = columns[i].id = "i"+smdui.uid();
                if (!columns[i].header)
                    columns[i].header = "";
            }
            if (map)
                this._scheme_init_order.push(this._process_single_map(id, map, columns[i]));

            this._map_options(columns[i]);
        }
    },
    _map_options:function(element){
        var options = element.options||element.collection;
        if(options){
            if (typeof options === "string"){
                //id of some other view
                var options_view = smdui.$$(options);
                //or url
                if (!options_view){
                    options_view = new smdui.DataCollection({ url: options });
                    this._destroy_with_me.push(options_view);
                }
                //if it was a view, special check for suggests
                if (options_view.getBody) options_view = options_view.getBody();
                this._bind_collection(options_view, element);
            } else if (!options.loadNext){
                if (options[0] && typeof options[0] == "object"){
                    //[{ id:1, value:"one"}, ...]
                    options = new smdui.DataCollection({ data:options });
                    this._bind_collection(options, element);
                    this._destroy_with_me.push(options);
                } else {
                    //["one", "two"]
                    //or
                    //{ 1: "one", 2: "two"}
                    if (smdui.isArray(options)){
                        var data = {};
                        for (var ij=0; ij<options.length; ij++) data[options[ij]] = options[ij];
                        element.options = options = data;
                    }
                    element.template = element.template || this._collection_accesser(options, element.id, element.optionslist);
                }
            } else {
                //data collection or view
                this._bind_collection(options, element);
            }
        }
    },
    _bind_collection:function(options, element){
        if (element){
            delete element.options;
            element.collection = options;
            element.template = element.template || this._bind_accesser(options, element.id, element.optionslist);
	        var id = options.data.attachEvent("onStoreUpdated", smdui.bind(function(){
		        this.refresh();
                if(this.refreshFilter)
                    this.refreshFilter(element.id);
	        }, this));
            this.attachEvent("onDestruct", function(){
            	if (!options.$destructed) options.data.detachEvent(id);
            });
        }
    },
    _collection_accesser:function(options, id, multi){
        if (multi){
            var separator = typeof multi=="string"?multi:",";
            return function(obj, common){
                var value = obj[id] || obj.value;
                if (!value) return "";
                var ids = value.split(separator);
                for (var i = 0; i < ids.length; i++)
                    ids[i] = options[ids[i]] || "";
                
                return ids.join(", ");
            };
        } else {
            return function(obj, common){
                return options[obj[id]]||obj.value||"";
            };
        }
    },
    _bind_accesser:function(col, id, multi){
        if (multi) {
            var separator = typeof multi=="string"?multi:",";
            return function(obj, common){
                var value = obj[id] || obj.value;
                if (!value) return "";

                var ids = value.split(separator);
                for (var i = 0; i < ids.length; i++){
                    var data = col.data.pull[ids[i]];
                    ids[i] = data ? (data.value  || "") : "";
                }
                
                return ids.join(", ");
            };
        } else {
            return function(obj, common){
                var prop = obj[id]||obj.value,
                    data = col.data.pull[prop];
                if (data && (data.value || data.value ===0))
                    return data.value;
                return "";
            };
        }
    }
};
smdui.Undo= {
	$init:function(){
		this._undoHistory = smdui.extend([],smdui.PowerArray,true);
		this._undoCursor = -1;
	},
	undo_setter: function(value){
		if(value){
			this._init_undo();
			this._init_undo = function(){};
		}
		return value;
	},
	_init_undo: function(){
		var view = this;

		// drag-n-drop
		this.attachEvent("onBeforeDrop", function(context){
			if(context.from == context.to){
				var item = view._draggedItem = smdui.copy(this.getItem(context.start));
				if(this.data.branch){
					item.$index = this.getBranchIndex(item.id);
				}
				else
					item.$index = this.getIndexById(item.id);
			}
		});
		this.data.attachEvent("onDataMove", function( sid ){
			if(view._draggedItem && view._draggedItem.id == sid){
				var data = view._draggedItem;
				view._draggedItem = null;
				view._addToHistory(sid, data, "move");
			}
		});

		// add, remove
		this.data.attachEvent("onBeforeDelete", function(id){
			if(this.getItem(id)){
				var item = view._deletedItem = smdui.copy(this.getItem(id));
				if(this.branch){
					item.$index = this.getBranchIndex(id);
					if(this.branch[id])
						item.$branch = smdui.copy(this.serialize(id));
				}
				else
					item.$index = this.getIndexById(id);
			}
		});
		this.data.attachEvent("onDataUpdate", function(id, data, old){
			view._addToHistory(id+"", old, "update");
		});
		this.data.attachEvent("onStoreUpdated", function(id, item, mode){
			var data = null;
			if(id){
				if(mode == "add"){
					data = smdui.copy(item);
				}
				else if( mode == "delete") {
					data = view._deletedItem;
				}

				if(data)
					view._addToHistory(id, data, mode);
			}
		});

		// id change
		this.data.attachEvent("onIdChange", function(oldId,newId){
			if(typeof oldId == "object")
				oldId = oldId.row;
			for(var i =0; i < view._undoHistory.length; i++){
				if(view._undoHistory[i].id == oldId){
					view._undoHistory[i].id = newId;
				}
			}
		});
	},
	_addToHistory: function(id, data, action){
		if(!this._skipHistory && this._settings.undo){
			this._undoHistory.push({id: id, action: action, data: data});
			if(this._undoHistory.length==20)
				this._undoHistory.splice(0,1);
			if(!this._skipCursorInc)
				this._undoCursor = this._undoHistory.length - 1;
		}
	},
	ignoreUndo: function(func, master){
		 this._skipHistory = true;
		 func.call(master||this);
		 this._skipHistory = false;
	},
	removeUndo: function(id){
		for( var i = this._undoHistory.length-1; i >=0; i--){
			if(this._undoHistory[i].id == id){
				if(this._undoHistory[i].action == "id"){
					id = this._undoHistory[i].data;
				}
				this._undoHistory.removeAt(i);
			}
		}
		this._undoCursor = this._undoHistory.length - 1;
	},
	undo: function(id){
		if(id){
			this.ignoreUndo(function(){
				var data, i;
				for( i = this._undoHistory.length-1; !data && i >=0; i--){
					if(this._undoHistory[i].id == id)
						data = this._undoHistory[i];
				}

				if(data){
					/*if(data.action == "id")
						id = data.data;*/
					this._undoAction(data);
					this._undoHistory.removeAt(i+1);
					this._undoCursor = this._undoHistory.length - 1;
				}
			});
		}
		else{
			var data = this._undoHistory[this._undoCursor];
			if(data){
				this.ignoreUndo(function(){
					this._undoAction(data);
					this._undoHistory.removeAt(this._undoCursor);
				});
				this._undoCursor--;
				/*if(data.action == "id")
					this.undo();*/
			}
		}
	},
	_undoAction: function(obj){
		if(obj.action == "delete"){
			var branch = null,
				parentId = obj.data.$parent;

			if(obj.data.$branch){
				branch = {
					parent: obj.id,
					data: smdui.copy(obj.data.$branch)
				};
				delete obj.data.$branch;
				if(parentId && !this.data.branch[parentId])
					parentId = 0;
			}

			this.add(obj.data, obj.data.$index, parentId);
			if(branch){
				this.parse(branch);
			}
		}
		else if(obj.action == "add"){
			this.remove(obj.id);
		}
		else if(obj.action == "update"){
			this.updateItem(obj.id, obj.data);
		}
		else if(obj.action == "move"){
			if(obj.data.$parent){
				if(this.getItem(obj.data.$parent))
					this.move(obj.id, obj.data.$index, null, {parent: obj.data.$parent});
			}
			else
				this.move(obj.id, obj.data.$index);
		}
		/*else if(obj.action == "id"){
			this.data.changeId(obj.id, obj.data);
		}*/
	}
};

/*
	Behavior:DataLoader - load data in the component
	
	@export
		load
		parse
*/
smdui.DataLoader=smdui.proto({
	$init:function(config){
		//prepare data store
		config = config || "";
		
		//list of all active ajax requests
		this._ajax_queue = smdui.toArray();
		this._feed_last = {};

		this.data = new smdui.DataStore();

		this.data.attachEvent("onClearAll",smdui.bind(this._call_onclearall,this));
		this.data.attachEvent("onServerConfig", smdui.bind(this._call_on_config, this));
		this.attachEvent("onDestruct", this._call_onclearall);

		this.data.feed = this._feed;
		this.data.owner = config.id;
	},
	_feed:function(from,count,callback){
		//allow only single request at same time
		if (this._load_count)
			return (this._load_count=[from,count,callback]);	//save last ignored request
		else
			this._load_count=true;
		this._feed_last.from = from;
		this._feed_last.count = count;
		this._feed_common.call(this, from, count, callback);
	},
	_feed_common:function(from, count, callback, url, details){
		var state = null,
			url = url || this.data.url;

		var final_callback = [
			{ success: this._feed_callback, error: this._feed_callback },
			callback
		];

		if (from<0) from = 0;

		if(!details)
			details = { start: from, count:count };

		if(this.count())
			details["continue"] = "true";

		if (this.getState)
			state = this.getState();

		// proxy
		if (url && typeof url != "string"){
			if (state){
				if (state.sort)
					details.sort = state.sort;
				if (state.filter)
					details.filter = state.filter;
			}
			this.load(url, final_callback, details);
		} else { // GET
			url = url+((url.indexOf("?")==-1)?"?":"&");

			var params = [];
			for(var d in details){
				params.push(d+"="+details[d]);
			}
			if (state){
				if (state.sort)
					params.push("sort["+state.sort.id+"]="+encodeURIComponent(state.sort.dir));
				if (state.filter)
					for (var key in state.filter){
						var filterValue = state.filter[key];
						if(typeof filterValue == "object")
							filterValue = smdui.ajax().stringify(filterValue); //server daterangefilter
						params.push("filter["+key+"]="+encodeURIComponent(filterValue));
					}
			}

			url += params.join("&");
			if (this._feed_last.url !== url){
				this._feed_last.url = url;
				this.load(url, final_callback);
			} else {
				this._load_count = false;
			}
		}
	},
	_feed_callback:function(){
		//after loading check if we have some ignored requests
		var temp = this._load_count;
		this._load_count = false;
		if (typeof temp =="object")
			this.data.feed.apply(this, temp);	//load last ignored request
	},
	//loads data from external URL
	load:function(url,call){
		var url = smdui.proxy.$parse(url);
		var ajax = smdui.AtomDataLoader.load.apply(this, arguments);

		//prepare data feed for dyn. loading
		if (!this.data.url)
			this.data.url = url;

		return ajax;
	},
	//load next set of data rows
	loadNext:function(count, start, callback, url, now){
		var config = this._settings;
		if (config.datathrottle && !now){
			if (this._throttle_request)
				window.clearTimeout(this._throttle_request);
			this._throttle_request = smdui.delay(function(){
				this.loadNext(count, start, callback, url, true);
			},this, 0, config.datathrottle);
			return;
		}

		if (!start && start !== 0) start = this.count();
		if (!count)
			count = config.datafetch || this.count();

		this.data.url = this.data.url || url;
		if (this.callEvent("onDataRequest", [start,count,callback,url]) && this.data.url)
			this.data.feed.call(this, start, count, callback);
	},
	_maybe_loading_already:function(count, from){
		var last = this._feed_last;
		if(this._load_count && last.url){
			if (last.from<=from && (last.count+last.from >= count + from )) return true;
		}
		return false;
	},
	removeMissed_setter:function(value){
		return (this.data._removeMissed = value);
	},
	//init of dataprocessor delayed after all settings processing
	//because it need to be the last in the event processing chain
	//to get valid validation state
	_init_dataprocessor:function(){
		var url = this._settings.save;

		if (url === true)
			url = this._settings.save = this._settings.url;

		var obj = { master: this };
		
		if (url && url.url)
			smdui.extend(obj, url);
		else
			obj.url = url;

		smdui.dp(obj);
	},
	save_setter:function(value){
		if (value)
			this.$ready.push(this._init_dataprocessor);

		return value;
	},
	scheme_setter:function(value){
		this.data.scheme(value);
	},
	dataFeed_setter:function(value){
		value = smdui.proxy.$parse(value);

		this.data.attachEvent("onBeforeFilter", smdui.bind(function(text, filtervalue){
			//complex filtering, can't be routed to dataFeed
			if (typeof text == "function") return true;

			//we have dataFeed and some text
			if (this._settings.dataFeed && (text || filtervalue)){
				text = text || "id";
				if (filtervalue && typeof filtervalue == "object")
						filtervalue = filtervalue.id;

				this.clearAll();
				var url = this._settings.dataFeed;

				//js data feed
				if (typeof url == "function"){
					var filter = {};
					filter[text] = filtervalue;
					url.call(this, filtervalue, filter);
				} else if (url.$proxy) {
					if (url.load){
						var filterobj = {}; filterobj[text] = filtervalue;
						url.load(this, {
							success: this._onLoad,
							error: this._onLoadError
						}, { filter: filterobj });
					}
				} else {
				//url data feed
					var urldata = "filter["+text+"]="+encodeURIComponent(filtervalue);
					this.load(url+(url.indexOf("?")<0?"?":"&")+urldata, this._settings.datatype);
				}
				return false;
			}
		},this));
		return value;
	},
	_call_onready:function(){
		if (this._settings.ready && !this._ready_was_used){
			var code = smdui.toFunctor(this._settings.ready, this.$scope);
			if (code)
				smdui.delay(code, this, arguments);
			if (this.callEvent)
				smdui.delay(this.callEvent, this, ["onReady", []]);
			this._ready_was_used = true;
		}
	},
	_call_onclearall:function(soft){
		for (var i = 0; i < this._ajax_queue.length; i++){
			var xhr = this._ajax_queue[i];

			//IE9 and IE8 deny extending of ActiveX wrappers
			try { xhr.aborted = true; } catch(e){ 
				smdui._xhr_aborted.push(xhr);
			}
			xhr.abort();
		}
		if (!soft){
			this._load_count = false;
			this._feed_last = {};
			this._ajax_queue = smdui.toArray();
			this.waitData = smdui.promise.defer();
		}
	},
	_call_on_config:function(config){
		this._parseSeetingColl(config);
	}
},smdui.AtomDataLoader);

//ie8 compatibility
smdui._xhr_aborted = smdui.toArray();

smdui.DataMarks = {
	addCss:function(id, css, silent){
		if (!this.addRowCss && !silent){
			if (!this.hasCss(id, css)){
				var node = this.getItemNode(id);
				if (node){
					node.className += " "+css;
					silent = true;
				}
			}
		}
		return this.data.addMark(id, css, 1, 1, silent);
	},
	removeCss:function(id, css, silent){
		if (!this.addRowCss && !silent){
			if (this.hasCss(id, css)){
				var node = this.getItemNode(id);
				if (node){
					node.className = node.className.replace(css,"").replace("  "," ");
					silent = true;
				}
			}
		}
		return this.data.removeMark(id, css, 1, silent);
	},
	hasCss:function(id, mark){
		return this.data.getMark(id, mark);
	},
	clearCss:function(css, silent){
		return this.data.clearMark(css, 1, silent);
	}
};

/*
	DataStore is not a behavior, it standalone object, which represents collection of data.
	Call provideAPI to map data API

	@export
		exists
		getIdByIndex
		getIndexById
		get
		set
		refresh
		count
		sort
		filter
		next
		previous
		clearAll
		first
		last
*/
smdui.DataStore = function(){
	this.name = "DataStore";
	
	smdui.extend(this, smdui.EventSystem);

	this.setDriver("json");	//default data source is an
	this.pull = {};						//hash of IDs
	this.order = smdui.toArray();		//order of IDs
	this._marks = {};
};

smdui.DataStore.prototype={
	//defines type of used data driver
	//data driver is an abstraction other different data formats - xml, json, csv, etc.
	setDriver:function(type){
		smdui.assert(smdui.DataDriver[type],"incorrect DataDriver");
		this.driver = smdui.DataDriver[type];
	},
	//process incoming raw data
	_parse:function(data,master){
		this.callEvent("onParse", [this.driver, data]);

		if (this._filter_order)
			this.filter();
	
		//get size and position of data
		var info = this.driver.getInfo(data);

		//generated by connectors only
		if (info.key)
			smdui.securityKey = info.key;

		if (info.config)
			this.callEvent("onServerConfig",[info.config]);

		var options = this.driver.getOptions(data);
		if (options)
			this.callEvent("onServerOptions", [options]);

		//get array of records
		var recs = this.driver.getRecords(data);

		this._inner_parse(info, recs);

		//in case of tree store we may want to group data
		if (this._scheme_group && this._group_processing && !this._not_grouped_order)
			this._group_processing(this._scheme_group);

		//optional data sorting
		if (this._scheme_sort){
			this.blockEvent();
			this.sort(this._scheme_sort);
			this.unblockEvent();
		}

		this.callEvent("onStoreLoad",[this.driver, data]);
		//repaint self after data loading
		this.refresh();
	},
	_inner_parse:function(info, recs){
		var from = (info.from||0)*1;
		var subload = true;
		var marks = false;

		if (from === 0 && this.order[0] && this.order[this.order.length-1]){ //update mode
			if (this._removeMissed){
				//update mode, create kill list
				marks = {};
				for (var i=0; i<this.order.length; i++)
					marks[this.order[i]]=true;
			}
			
			subload = false;
			from = this.order.length;
        }
		var j=0;
		for (var i=0; i<recs.length; i++){
			//get hash of details for each record
			var temp = this.driver.getDetails(recs[i]);
			var id = this.id(temp); 	//generate ID for the record
			if (!this.pull[id]){		//if such ID already exists - update instead of insert
				this.order[j+from]=id;	
				j++;
			} else if (subload && this.order[j+from])
				j++;

			if(this.pull[id]){
				smdui.extend(this.pull[id],temp,true);//add only new properties
				if (this._scheme_update)
					this._scheme_update(this.pull[id]);
				//update mode, remove item from kill list
				if (marks)
					delete marks[id];
			} else{
				this.pull[id] = temp;
				if (this._scheme_init)
					this._scheme_init(temp);
			}
			
		}

		//update mode, delete items which are not existing in the new xml
		if (marks){
			this.blockEvent();
			for (var delid in marks)
				this.remove(delid);
			this.unblockEvent();
		}

		if (!this.order[info.size-1])
			this.order[info.size-1] = smdui.undefined;
	},
	//generate id for data object
    id: function (data) {
		return data.id||(data.id=smdui.uid());
	},
	changeId:function(old, newid){
		//smdui.assert(this.pull[old],"Can't change id, for non existing item: "+old);
		if(this.pull[old])
			this.pull[newid] = this.pull[old];
		
		this.pull[newid].id = newid;
		this.order[this.order.find(old)]=newid;
		if (this._filter_order)
			this._filter_order[this._filter_order.find(old)]=newid;
		if (this._marks[old]){
			this._marks[newid] = this._marks[old];
			delete this._marks[old];
		}


		this.callEvent("onIdChange", [old, newid]);
		if (this._render_change_id)
			this._render_change_id(old, newid);
		delete this.pull[old];
	},
	//get data from hash by id
	getItem:function(id){
		return this.pull[id];
	},
	//assigns data by id
	updateItem:function(id, update, mode){
		var data = this.getItem(id);
		var old = null;

		//check is change tracking active
		var changeTrack = this.hasEvent("onDataUpdate");
	
		smdui.assert(data, "Ivalid ID for updateItem");
		smdui.assert(!update || !update.id || update.id == id, "Attempt to change ID in updateItem");
		if (!smdui.isUndefined(update) && data !== update){
			//preserve original object
			if (changeTrack)
				old = smdui.copy(data);

			id = data.id;	//preserve id
			smdui.extend(data, update, true);
			data.id = id;
		}

		if (this._scheme_update)
			this._scheme_update(data);

		this.callEvent("onStoreUpdated",[id.toString(), data, (mode||"update")]);

		if (changeTrack)
			this.callEvent("onDataUpdate", [id, data, old]);
	},
	//sends repainting signal
	refresh:function(id){
		if (this._skip_refresh) return; 
		
		if (id){
			if (this.exists(id))
				this.callEvent("onStoreUpdated",[id, this.pull[id], "paint"]);
		}else
			this.callEvent("onStoreUpdated",[null,null,null]);
	},
	silent:function(code, master){
		this._skip_refresh = true;
		code.call(master||this);
		this._skip_refresh = false;
	},
	//converts range IDs to array of all IDs between them
	getRange:function(from,to){		
		//if some point is not defined - use first or last id
		//BEWARE - do not use empty or null ID
		if (from)
			from = this.getIndexById(from);
		else 
			from = (this.$min||this.startOffset)||0;
		if (to)
			to = this.getIndexById(to);
		else {
			to = this.$max === 0 ? 0 : Math.min((this.$max?this.$max-1:(this.endOffset||Infinity)),(this.count()-1));
			if (to<0) to = 0; //we have not data in the store
		}

		if (from>to){ //can be in case of backward shift-selection
			var a=to; to=from; from=a;
		}

		return this.getIndexRange(from,to);
	},
	//converts range of indexes to array of all IDs between them
	getIndexRange:function(from,to){
		to=Math.min((to === 0 ? 0 :(to||Infinity)),this.count()-1);
		
		var ret=smdui.toArray(); //result of method is rich-array
		for (var i=(from||0); i <= to; i++)
			ret.push(this.getItem(this.order[i]));
		return ret;
	},
	//returns total count of elements
	count:function(){
		return this.order.length;
	},
	//returns truy if item with such ID exists
	exists:function(id){
		return !!(this.pull[id]);
	},
	//nextmethod is not visible on component level, check DataMove.move
	//moves item from source index to the target index
	move:function(sindex,tindex){
		smdui.assert(sindex>=0 && tindex>=0, "DataStore::move","Incorrect indexes");
		if (sindex == tindex) return;

		var id = this.getIdByIndex(sindex);
		var obj = this.getItem(id);

		if (this._filter_order)
			this._move_inner(this._filter_order, 0, 0, this.getIdByIndex(sindex), this.getIdByIndex(tindex));

		this._move_inner(this.order, sindex, tindex);
		
		
		//repaint signal
		this.callEvent("onStoreUpdated",[id,obj,"move"]);
	},
	_move_inner:function(col, sindex, tindex, sid, tid){
		if (sid||tid){
			sindex = tindex = -1;
			for (var i=0; i<col.length; i++){
				if (col[i] == sid && sindex<0)
					sindex = i;
				if (col[i] == tid && tindex<0)
					tindex = i;
			}
		}
		var id = col[sindex];
		col.removeAt(sindex);	//remove at old position
		col.insertAt(id,Math.min(col.length, tindex));	//insert at new position
	},
	scheme:function(config){
		this._scheme = {};
		this._scheme_save = config.$save;
		this._scheme_init = config.$init||config.$change;
		this._scheme_update = config.$update||config.$change;
		this._scheme_serialize = config.$serialize;
		this._scheme_group = config.$group;
		this._scheme_sort = config.$sort;

		//ignore $-starting properties, as they have special meaning
		for (var key in config)
			if (key.substr(0,1) != "$")
				this._scheme[key] = config[key];
	},
	importData:function(target, silent){
		var data = target ? (target.data || target) : [];
		this._filter_order = null;

		if (typeof data.serialize == "function"){
			this.order = smdui.toArray([].concat(data.order));

			//make full copy, to preserve object properties
			//[WE-CAN-DO-BETTER]
			if (this._make_full_copy){
				this._make_full_copy = false;
				this.pull = {};
				for (var key in data.pull)
					this.pull[key] = smdui.copy(data.pull[key]);
			}
			else
				this.pull = data.pull;

			if (data.branch && this.branch){
				this.branch = smdui.copy(data.branch);
				this._filter_branch = null;
			}

		} else {
			this.order = smdui.toArray();
			this.pull = {};
			var id, obj;

			if (smdui.isArray(target))
				for (var key=0; key<target.length; key++){
					obj = id = target[key];
					if (typeof obj == "object")
						obj.id  = obj.id || smdui.uid();
					else
						obj = { id:id, value:id };

					this.order.push(obj.id);
					if (this._scheme_init)
						this._scheme_init(obj);
					this.pull[obj.id] = obj;
				}
			else
				for (var key in data){
					this.order.push(key);
					this.pull[key] = { id:key, value: data[key] };
				}
		}
		if (this._extraParser && !data.branch){
			this.branch = { 0:[]};
			if (!this._datadriver_child)
				this._set_child_scheme("data");

			for (var i = 0; i<this.order.length; i++){
				var key = this.order[i];
				this._extraParser(this.pull[key], 0, 0, false);
			}
		}

		this.callEvent("onStoreLoad",[]);
		if (!silent)
			this.callEvent("onStoreUpdated",[]);
	},
	sync:function(source, filter, silent){
		this.unsync();

		var type = typeof source;
		if (type == "string")
			source = smdui.$$("source");

		if (type != "function" && type != "object"){
			silent = filter;
			filter = null;
		}
		
		if (smdui.debug_bind){
			this.debug_sync_master = source; 
			smdui.log("[sync] "+this.debug_bind_master.name+"@"+this.debug_bind_master._settings.id+" <= "+this.debug_sync_master.name+"@"+this.debug_sync_master._settings.id);
		}

		if (source.name != "DataStore"){
			if (source.data && (source.data.name === "DataStore" || source.data.name === "TreeStore"))
				source = source.data;
			else {
				this._sync_source = source;
				return smdui.callEvent("onSyncUnknown", [this, source, filter]);
			}
		}

		var	sync_logic = smdui.bind(function(mode, record, data){
			if (this._skip_next_sync) return;

			//sync of tree-structure with after-filtering
			//we need to make a full copy, to preserve $count
			//[WE-CAN-DO-BETTER]
			if (filter && this.branch) this._make_full_copy = true;
			this.importData(source, true);
			
			if (filter)
				this.silent(filter);
			if (this._on_sync)
				this._on_sync();
			if (this._make_full_copy){

			}

			if (smdui.debug_bind)
				smdui.log("[sync:request] "+this.debug_sync_master.name+"@"+this.debug_sync_master._settings.id + " <= "+this.debug_bind_master.name+"@"+this.debug_bind_master._settings.id);

			this.callEvent("onSyncApply",[]);

			if (!silent) 
				this.refresh();
			else
				silent = false;
		}, this);



		this._sync_events = [
			source.attachEvent("onStoreUpdated", sync_logic),
			source.attachEvent("onIdChange", smdui.bind(function(old, nid){ this.changeId(old, nid); this.refresh(nid); }, this))
		];
		this._sync_source = source;

		//backward data saving
		this._back_sync_handler = this.attachEvent("onStoreUpdated", function(id, data, mode){
			if (mode == "update" || mode == "save"){
				this._skip_next_sync = 1;
				source.updateItem(id, data);
				this._skip_next_sync = 0;
			}
		});

		sync_logic();
	},
	unsync:function(){
		if (this._sync_source){
			var source = this._sync_source;

			if (source.name != "DataStore" &&
					(!source.data || source.data.name != "DataStore")){
				//data sync with external component
				smdui.callEvent("onUnSyncUnknown", [this, source]);
			} else {
				//data sync with smdui component
				for (var i = 0; i < this._sync_events.length; i++)
					source.detachEvent(this._sync_events[i]);
				this.detachEvent(this._back_sync_handler);
			}

			this._sync_source = null;
		}
	},
	destructor:function(){
		this.unsync();

		this.pull = this.order = this._marks = null;
		this._evs_events = this._evs_handlers = {};
	},
	//adds item to the store
	add:function(obj,index){
		//default values		
		if (this._scheme)
			for (var key in this._scheme)
				if (smdui.isUndefined(obj[key]))
					obj[key] = this._scheme[key];
		
		if (this._scheme_init)
			this._scheme_init(obj);
		
		//generate id for the item
		var id = this.id(obj);

		//in case of treetable order is sent as 3rd parameter
		var order = arguments[2]||this.order;
		
		//by default item is added to the end of the list
		var data_size = order.length;
		
		if (smdui.isUndefined(index) || index < 0)
			index = data_size; 
		//check to prevent too big indexes			
		if (index > data_size){
			smdui.log("Warning","DataStore:add","Index of out of bounds");
			index = Math.min(order.length,index);
		}
		if (this.callEvent("onBeforeAdd", [id, obj, index]) === false) return false;

		smdui.assert(!this.exists(id), "Not unique ID");
		
		this.pull[id]=obj;
		order.insertAt(id,index);
		if (this._filter_order){	//adding during filtering
			//we can't know the location of new item in full dataset, making suggestion
			//put at end of original dataset by default
			var original_index = this._filter_order.length;
			//if some data exists, put at the same position in original and filtered lists
			if (this.order.length)
				original_index = Math.min((index || 0), original_index);

			this._filter_order.insertAt(id,original_index);
		}
		
		//repaint signal
		this.callEvent("onStoreUpdated",[id,obj,"add"]);
		this.callEvent("onAfterAdd",[id,index]);

		return obj.id;
	},
	
	//removes element from datastore
	remove:function(id){
		//id can be an array of IDs - result of getSelect, for example
		if (smdui.isArray(id)){
			for (var i=0; i < id.length; i++)
				this.remove(id[i]);
			return;
		}
		if (this.callEvent("onBeforeDelete",[id]) === false) return false;
		
		smdui.assert(this.exists(id), "Not existing ID in remove command"+id);

		var obj = this.getItem(id);	//save for later event
		//clear from collections
		this.order.remove(id);
		if (this._filter_order) 
			this._filter_order.remove(id);
			
		delete this.pull[id];
		if (this._marks[id])
			delete this._marks[id];

		//repaint signal
		this.callEvent("onStoreUpdated",[id,obj,"delete"]);
		this.callEvent("onAfterDelete",[id]);
	},
	//deletes all records in datastore
	clearAll:function(soft){
		//instead of deleting one by one - just reset inner collections
		this.pull = {};
		this._marks = {};
		this.order = smdui.toArray();
		//this.feed = null;
		this._filter_order = null;
		if (!soft)
			this.url = null;
		this.callEvent("onClearAll",[soft]);
		this.refresh();
	},
	//converts id to index
	getIdByIndex:function(index){
		smdui.assert(index >= 0,"DataStore::getIdByIndex Incorrect index");
		return this.order[index];
	},
	//converts index to id
	getIndexById:function(id){
		var res = this.order.find(id);	//slower than getIdByIndex
		if (!this.pull[id])
			return -1;
			
		return res;
	},
	//returns ID of next element
	getNextId:function(id,step){
		return this.order[this.getIndexById(id)+(step||1)];
	},
	//returns ID of first element
	getFirstId:function(){
		return this.order[0];
	},
	//returns ID of last element
	getLastId:function(){
		return this.order[this.order.length-1];
	},
	//returns ID of previous element
	getPrevId:function(id,step){
		return this.order[this.getIndexById(id)-(step||1)];
	},
	/*
		sort data in collection
			by - settings of sorting
		
		or
		
			by - sorting function
			dir - "asc" or "desc"
			
		or
		
			by - property
			dir - "asc" or "desc"
			as - type of sortings
		
		Sorting function will accept 2 parameters and must return 1,0,-1, based on desired order
	*/
	sort:function(by, dir, as){
		var sort = by;	
		if (typeof by == "function")
			sort = {as:by, dir:dir};
		else if (typeof by == "string")
			sort = {by:by.replace(/#/g,""), dir:dir, as:as};

		
		var parameters = [sort.by, sort.dir, sort.as, sort];
		if (!this.callEvent("onBeforeSort",parameters)) return;	
		
		this.order = this._sort_core(sort, this.order);
		if (this._filter_order && this._filter_order.length != this.order.length)
			this._filter_order = this._sort_core(sort, this._filter_order);
		
		//repaint self
		this.refresh();
		
		this.callEvent("onAfterSort",parameters);
	},
	_sort_core:function(sort, order){
		var sorter = this.sorting.create(sort);
		if (this.order.length){
			var pre = order.splice(0, this.$freeze);
			//get array of IDs
			var neworder = smdui.toArray();
			for (var i=order.length-1; i>=0; i--)
				neworder[i] = this.pull[order[i]];
			
			neworder.sort(sorter);
			return smdui.toArray(pre.concat(neworder.map(function(obj){ 
				smdui.assert(obj, "Client sorting can't be used with dynamic loading");
				return this.id(obj);
			},this)));
		}
		return order;
	},
	/*
		Filter datasource
		
		text - property, by which filter
		value - filter mask
		
		or
		
		text  - filter method
		
		Filter method will receive data object and must return true or false
	*/
	_filter_reset:function(preserve){
		//remove previous filtering , if any
		if (this._filter_order && !preserve){
			this.order = this._filter_order;
			delete this._filter_order;
		}
	},
	_filter_core:function(filter, value, preserve){
		var neworder = smdui.toArray();
		var freeze = this.$freeze || 0;
		
		for (var i=0; i < this.order.length; i++){
			var id = this.order[i];
			if (i < freeze || filter(this.getItem(id),value))
				neworder.push(id);
		}
		//set new order of items, store original
		if (!preserve ||  !this._filter_order)
			this._filter_order = this.order;
		this.order = neworder;
	},
	find:function(config, first){
		var result = [];

		for(var i in this.pull){
			var data = this.pull[i];

			var match = true;
			if (typeof config == "object"){
				for (var key in config)
					if (data[key] != config[key]){
						match = false;
						break;
					}
			} else if (!config(data))
				match = false;

			if (match)
				result.push(data);
			
			if (first && result.length)
				return result[0];
		}

		return result;
	},
	filter:function(text,value,preserve){
		//unfilter call but we already in not-filtered state
		if (!text && !this._filter_order && !this._filter_branch) return;
		if (!this.callEvent("onBeforeFilter", [text, value])) return;
		
		this._filter_reset(preserve);
		if (!this.order.length) return;
		
		//if text not define -just unfilter previous state and exit
		if (text){
			var filter = text;
			value = value||"";
			if (typeof text == "string"){
				text = text.replace(/#/g,"");
				if (typeof value == "function")
					filter = function(obj){
						return value(obj[text]);
					};
				else{
					value = value.toString().toLowerCase();
					filter = function(obj,value){	//default filter - string start from, case in-sensitive
						smdui.assert(obj, "Client side filtering can't be used with dynamic loading");
						return (obj[text]||"").toString().toLowerCase().indexOf(value)!=-1;
					};
				}
			}
			
			this._filter_core(filter, value, preserve, this._filterMode);
		}
		//repaint self
		this.refresh();
		
		this.callEvent("onAfterFilter", []);
	},
	/*
		Iterate through collection
	*/
	_obj_array:function(){
		var data = [];
		for (var i = this.order.length - 1; i >= 0; i--)
			data[i]=this.pull[this.order[i]];

		return data;
	},
	each:function(method, master, all){
		var order = this.order;
		if (all)
			order = this._filter_order || order;

		for (var i=0; i<order.length; i++)
			method.call((master||this), this.getItem(order[i]), i);
	},
	_methodPush:function(object,method){
		return function(){ return object[method].apply(object,arguments); };
	},
	/*
		map inner methods to some distant object
	*/
	provideApi:function(target,eventable){
		this.debug_bind_master = target;
			
		if (eventable){
			this.mapEvent({
				onbeforesort:	target,
				onaftersort:	target,
				onbeforeadd:	target,
				onafteradd:		target,
				onbeforedelete:	target,
				onafterdelete:	target,
				ondataupdate:	target/*,
				onafterfilter:	target,
				onbeforefilter:	target*/
			});
		}
			
		var list = ["sort","add","remove","exists","getIdByIndex","getIndexById","getItem","updateItem","refresh","count","filter","find","getNextId","getPrevId","clearAll","getFirstId","getLastId","serialize","sync"];
		for (var i=0; i < list.length; i++)
			target[list[i]] = this._methodPush(this,list[i]);
	},
	addMark:function(id, mark, css, value, silent){
		var obj = this._marks[id]||{};
		this._marks[id] = obj;
		if (!obj[mark]){
			obj[mark] = value||true;	
			if (css){
				var old_css = obj.$css||"";
				obj.$css = old_css+" "+mark;
			}
			if (!silent)
				this.refresh(id);
		}
		return obj[mark];
	},
	removeMark:function(id, mark, css, silent){
		var obj = this._marks[id];
		if (obj){
			if (obj[mark])
				delete obj[mark];
			if (css){
				var current_css = obj.$css;
				if (current_css){
					obj.$css = current_css.replace(mark, "").replace("  "," ");
				}
			}
			if (!silent) 
				this.refresh(id);
		}
	},
	getMark:function(id, mark){
		var obj = this._marks[id];
		return (obj?obj[mark]:false);
	},
	clearMark:function(name, css, silent){
		for (var id in this._marks){
			var obj = this._marks[id];
			if (obj[name]){
				delete obj[name];
				if (css && obj.$css)
					obj.$css = obj.$css.replace(name, "").replace("  "," ");
				if (!silent)
					this.refresh(id);
			}
		}
	},	
	/*
		serializes data to a json object
	*/
	serialize: function(all){
		var ids = this.order;
		if (all && this._filter_order)
			ids = this._filter_order;

		var result = [];
		for(var i=0; i< ids.length;i++) {
			var el = this.pull[ids[i]];
			if (this._scheme_serialize){
				el = this._scheme_serialize(el);
				if (el===false) continue;
			}
			result.push(el);
		}
		return result;
	},
	sorting:{
		create:function(config){
			return this._dir(config.dir, this._by(config.by, config.as));
		},
		as:{
			//handled by dataFeed
			"server":function(){
				return false;
			},
			"date":function(a,b){
				a=a-0; b=b-0;
				return a>b?1:(a<b?-1:0);
			},
			"int":function(a,b){
				a = a*1; b=b*1;
				return a>b?1:(a<b?-1:0);
			},
			"string_strict":function(a,b){
				a = a.toString(); b=b.toString();
				return a>b?1:(a<b?-1:0);
			},
			"string":function(a,b){
				if (!b) return 1;
				if (!a) return -1;
				
				a = a.toString().toLowerCase(); b=b.toString().toLowerCase();
				return a>b?1:(a<b?-1:0);
			},
			"raw":function(a,b){
				return a>b?1:(a<b?-1:0);
			}
		},
		_by:function(prop, method){
			if (!prop)
				return method;
			if (typeof method != "function")
				method = this.as[method||"string"];

			smdui.assert(method, "Invalid sorting method");
			return function(a,b){
				return method(a[prop],b[prop]);
			};
		},
		_dir:function(prop, method){
			if (prop == "asc" || !prop)
				return method;
			return function(a,b){
				return method(a,b)*-1;
			};
		}
	}
};


smdui.DataCollection = smdui.proto({
	name:"DataCollection",
	isVisible:function(){ 
		if (!this.data.order.length && !this.data._filter_order && !this._settings.dataFeed) return false;
		return true; 
	},
	$init:function(config){
		this.data.provideApi(this, true);
		var id = (config&&config.id)?config.id:smdui.uid();
		this._settings.id =id;
		smdui.ui.views[id] = this;
		this.data.attachEvent("onStoreLoad", smdui.bind(function(){
			this.callEvent("onBindRequest",[]);
		}, this));
	},
	refresh:function(){ this.callEvent("onBindRequest",[]); }
}, smdui.DataMove, smdui.CollectionBind, smdui.BindSource, smdui.ValidateCollection, smdui.DataLoader, smdui.MapCollection, smdui.EventSystem, smdui.BaseBind, smdui.Destruction, smdui.Settings);

smdui.Scrollable = {
	$init:function(config){
		//do not spam unwanted scroll containers for templates 
		if (config && !config.scroll && this._one_time_scroll) 
			return (this._dataobj = (this._dataobj||this._contentobj));
		
		(this._dataobj||this._contentobj).appendChild(smdui.html.create("DIV",{ "class" : "smdui_scroll_cont" },""));
		this._dataobj=(this._dataobj||this._contentobj).firstChild;

		if(!smdui.env.touch)
			smdui._event(this._viewobj,"scroll", smdui.bind(function(e){
				if(this.callEvent)
					smdui.delay(function(){
						this.callEvent("onAfterScroll", []);
					}, this);
			},this));
	},
	/*defaults:{
		scroll:true
	},*/
	scroll_setter:function(value){
		if (!value) return false;
		var marker =  (value=="x"?"x":(value=="xy"?"xy":(value=="a"?"xy":"y")));
		if (smdui.Touch && smdui.Touch.$active){
			this._dataobj.setAttribute("touch_scroll",marker);
			if (this.attachEvent)
				this.attachEvent("onAfterRender", smdui.bind(this._refresh_scroll,this));
			this._touch_scroll = true;
		} else {
			if (smdui.env.$customScroll){
				smdui.CustomScroll.enable(this, marker);
			} else {
				var node = this._dataobj.parentNode.style;
				if (value.toString().indexOf("a")!=-1){
					node.overflowX = node.overflowY = "auto";
				} else {
					if (marker.indexOf("x")!=-1){
						this._scroll_x = true;
						node.overflowX = "scroll";
					}
					if (marker.indexOf("y")!=-1){
						this._scroll_y = true;
						node.overflowY = "scroll";
					}
				}
			}
		}
		return marker;
	},
	_onoff_scroll:function(mode){
		if (!!this._settings.scroll == !!mode) return;

		if (!smdui.env.$customScroll){
			var style = this._dataobj.parentNode.style;
			style.overflowX = style.overflowY = mode?"auto":"hidden";
		}

		this._scroll_x = this._scroll_y = !!mode;
		this._settings.scroll = !!mode;
	},
	getScrollState:function(){
		if (smdui.Touch && smdui.Touch.$active){
			var temp = smdui.Touch._get_matrix(this._dataobj);
			return { x : -temp.e, y : -temp.f };
		} else
			return { x : this._dataobj.parentNode.scrollLeft, y : this._dataobj.parentNode.scrollTop };
	},
	scrollTo:function(x,y){
		if (smdui.Touch && smdui.Touch.$active){
			y = Math.max(0, Math.min(y, this._dataobj.offsetHeight - this._content_height));
			x = Math.max(0, Math.min(x, this._dataobj.offsetWidth - this._content_width));
			smdui.Touch._set_matrix(this._dataobj, -x, -y, this._settings.scrollSpeed||"100ms");
		} else {
			this._dataobj.parentNode.scrollLeft=x;
			this._dataobj.parentNode.scrollTop=y;
		}
	},
	_refresh_scroll:function(){
		if (this._settings.scroll.toString().indexOf("x")!=-1){
			var x =  this._dataobj.scrollWidth;
			if (x){ //in hidden state we will have a Zero scrollWidth
				this._dataobj.style.width = "100%";
				this._dataobj.style.width = this._dataobj.scrollWidth + "px";
			}
		}
			
		if(smdui.Touch && smdui.Touch.$active && this._touch_scroll){
			smdui.Touch._clear_artefacts();
			smdui.Touch._scroll_end();
			var s = this.getScrollState();
			var dx = this._dataobj.offsetWidth - this.$width - s.x;
			var dy = this._dataobj.offsetHeight - this.$height - s.y;

			//if current scroll is outside of data area
			if(dx<0 || dy < 0){
				//scroll to the end of data area
				var x = (dx<0?Math.min(-dx - s.x,0):- s.x);
				var y = (dy<0?Math.min(-dy - s.y,0):- s.y);
				smdui.Touch._set_matrix(this._dataobj, x, y, 0);
			}
		}
	}
};

/*
	UI:paging control
    建斌20180717修改
*/
smdui.protoUI({
    defaults: {
        size: 10,	//items on page
        page: 0,	//current page
        group: 5,
        template: "{common.first()} {common.prev()} {common.pages()} {common.next()} {common.last()} {common.records()}",
        maxWidth: 100000,
        height: 30,
        borderless: true
    },
    name: "pager",
    on_click: {
        //on paging button click
        "smdui_pager_item": function (e, id) {
            this.select(id);
        }
    },
    $init: function (config) {
        this.data = this._settings;
        this._dataobj = this._viewobj;
        this._viewobj.className += " smdui_pager";

        if (config.master === false || config.master === 0)
            this.$ready.push(this._remove_master);
    },
    _remove_master: function () {
        this.refresh();
        this.$master = { refresh: function () { }, select: function () { } };
    },
    select: function (id) {
        if (this.$master && this.$master.name == "pager")
            return this.$master.select(id);

        //id - id of button, number for page buttons
        switch (id) {
            case "next":
                id = this._settings.page + 1;
                break;
            case "prev":
                id = this._settings.page - 1;
                break;
            case "first":
                id = 0;
                break;
            case "last":
                id = this._settings.limit - 1;
                break;
            default:
                //use incoming id
                break;
        }
        if (id < 0) id = 0;
        if (id >= this.data.limit) id = this.data.limit - 1;

        var old = this.data.page;
        if (this.callEvent("onBeforePageChange", [id, old])) {
            this.data.page = id * 1; //must be int
            if (this.refresh()) {
                if (!this._settings.animate || !this._animate(old, id * 1, this._settings.animate))
                    this.$master.refresh();
            }
            this.callEvent("onAfterPageChange", [id]);
        }
    },
    _id: "smdui_p_id",
    template_setter: smdui.template,
    type: {
        template: function (a, b) { return a.template.call(this, a, b); },
        //list of page numbers
        pages: function (obj) {
            var html = "";
            //skip rendering if paging is not fully initialized
            if (obj.page == -1) return "";
            //current page taken as center of view, calculate bounds of group
            obj.$min = obj.page - Math.round((obj.group - 1) / 2);
            obj.$max = obj.$min + obj.group * 1 - 1;
            if (obj.$min < 0) {
                obj.$max += obj.$min * (-1);
                obj.$min = 0;
            }
            if (obj.$max >= obj.limit) {
                obj.$min -= Math.min(obj.$min, obj.$max - obj.limit + 1);
                obj.$max = obj.limit - 1;
            }
            //generate HTML code of buttons
            for (var i = (obj.$min || 0); i <= obj.$max; i++)
                html += this.button({ id: i, index: (i + 1), selected: (i == obj.page ? "_selected" : ""), label: smdui.i18n.aria.page + " " + (i + 1) });
            return html;
        },
        records: function (obj) {
            //alert(JSON.stringify(obj));
            return "共"+obj.count+"条";
        },
        page: function (obj) {
            return obj.page + 1;
        },
        //go-to-first page button
        first: function () {
            return this.button({ id: "first", index: smdui.locale.pager.first, selected: "", label: smdui.i18n.aria.pages[0] });
        },
        //go-to-last page button
        last: function () {
            return this.button({ id: "last", index: smdui.locale.pager.last, selected: "", label: smdui.i18n.aria.pages[3] });
        },
        //go-to-prev page button
        prev: function () {
            return this.button({ id: "prev", index: smdui.locale.pager.prev, selected: "", label: smdui.i18n.aria.pages[1] });
        },
        //go-to-next page button
        next: function () {
            return this.button({ id: "next", index: smdui.locale.pager.next, selected: "", label: smdui.i18n.aria.pages[2] });
        },
        button: smdui.template("<button type='button' smdui_p_id='{obj.id}' class='smdui_pager_item{obj.selected}' aria-label='{obj.label}'>{obj.index}</button>")
    },
    clone: function (pager) {
        if (!pager.$view) {
            pager.view = "pager";
            pager = smdui.ui(pager);
        }

        this._clone = pager;
        pager.$master = this;
        this._refresh_clone();
    },
    refresh: function () {
        var s = this._settings;
        if (!s.count) return;

        //max page number
        s.limit = Math.ceil(s.count / s.size);

        var newPage = Math.min(s.limit - 1, s.page);

        if (newPage != s.page)
            return this.$master.setPage(newPage);

        s.page = newPage;
        if (newPage >= 0 && (newPage != s.old_page) || (s.limit != s.old_limit) || (s.old_count != s.count)) {
            //refresh self only if current page or total limit was changed
            this.render();
            this._refresh_clone();
            s.old_limit = s.limit;	//save for onchange check in next iteration
            s.old_page = s.page;
            s.old_count = s.count;
            return true;
        }
    },
    apiOnly_setter: function (value) {
        return (this.$apiOnly = value);
    },
    _refresh_clone: function () {
        if (this._clone) {
            this._clone._settings.count = this._settings.count;
            this._clone._settings.page = this._settings.page;
            this._clone.refresh();
        }
    },
    _animate: function (old, id, config) {
        if (old == id) return false;
        if (this._pgInAnimation) {
            if (this._pgAnimateTimeout) {
                window.clearTimeout(this._pgAnimateTimeout);
            }
            return (this._pgAnimateTimeout = smdui.delay(this._animate, this, [old, id, config], 100));
        }
        var direction = id > old ? "left" : "right";
        if (config.direction == "top" || config.direction == "bottom")
            direction = id > old ? "top" : "bottom";
        if (config.flip)
            direction = "";



        //make copy of existing view
        var top = 0;
        var snode = this.$master._dataobj;
        if (this.$master._body) {	//datatable
            snode = this.$master._body;
            top = snode.offsetTop;
            smdui.html.addCss(this.$master.$view, "smdui_animation");
        }

        var onode = snode.cloneNode(true);
        onode.style.width = snode.style.width = "100%";

        //redraw page
        this.$master.refresh();
        //append copy next to original
        smdui.html.insertBefore(onode, snode.nextSibling, snode.parentNode);

        //animation config
        var line;
        var base = config !== true ? config : {};
        var aniset = smdui.extend({
            direction: direction,
            callback: smdui.bind(function () {
                aniset.callback = null;
                smdui.animate.breakLine(line);
                this._pgInAnimation = false;
                if (this.$master._body)
                    smdui.html.removeCss(this.$master.$view, "smdui_animation");
            }, this),
            top: top
        }, base);

        //run animation
        line = smdui.animate.formLine(snode, onode, aniset);
        smdui.animate([snode, onode], aniset);
        this._pgInAnimation = true;
    }
}, smdui.MouseEvents, smdui.SingleRender, smdui.ui.view, smdui.EventSystem);

smdui.locale.pager = {
    first: "First",
    last: "Last",
    next: "Next",
    prev: "Prev"
};

smdui.PagingAbility = {
    pager_setter: function (pager) {
        if (typeof pager == "string") {
            var ui_pager = smdui.$$(pager);
            if (!ui_pager) {
                this.$blockRender = true;
                smdui.delay(function () {
                    var obj = smdui.$$(pager);

                    this._settings.pager = this.pager_setter(obj);
                    var s = obj._settings;
                    s.count = this.data._count_pager_total(s.level);
                    obj.refresh();

                    this.$blockRender = false;
                    this.render();
                }, this);
                return null;
            }
            pager = ui_pager;
        }

        function check_pager_sizes(repeat) {
            if (pager.config.autosize && this.getVisibleCount) {
                var count = this.getVisibleCount();
                if (isNaN(count)) {
                    pager.config.size = 1;
                    smdui.delay(check_pager_sizes, this, [true]);
                } else if (count != pager.config.size) {
                    pager.config.size = count;
                    pager.refresh();
                    if (repeat === true)
                        this.refresh();
                }
            }

            var s = this._settings.pager;
            //initial value of pager = -1, waiting for real value
            if (s.page == -1) return false;

            this.data.$min = this._count_pager_index(0, s.page * s.size);	//affect data.getRange
            this.data.$max = this._count_pager_index(this.data.$min, s.size);
            this.data.$pagesize = this.data.$max - this.data.$min;

            return true;
        }

        this.attachEvent("onBeforeRender", check_pager_sizes);

        if (!pager.$view) {
            pager.view = "pager";
            pager = smdui.ui(pager);
        }
        this._pager = pager;
        pager.$master = this;

        this.data.attachEvent("onStoreUpdated", function () {
            var s = pager._settings;
            s.count = this._count_pager_total(s.level);
            pager.refresh();
        });
        this.data._count_pager_total = this._count_pager_total;

        return pager._settings;
    },
    _count_pager_total: function (level) {
        if (level && level !== 0) {
            var count = 0;
            this.each(function (obj) {
                if (obj.$level == level) count++;
            });
            return count;
        } else
            return this.count();
    },
    _count_pager_index: function (start, count) {
        var s = this._settings.pager;

        if (s.level && s.level !== 0) {
            var end = start;
            var max = this.data.order.length;

            if (count)
                while (end < max) {
                    if (this.data.getItem(this.data.order[end]).$level == s.level) {
                        if (count === 0)
                            break;
                        else
                            count--;
                    }
                    end++;
                }

            return end;
        } else
            return start + count;
    },
    setPage: function (value) {
        if (this._pager)
            this._pager.select(value);
    },
    getPage: function () {
        return this._pager._settings.page;
    },
    getPager: function () {
        return this._pager;
    }
};

/*
	Behavior: AutoTooltip - links tooltip to data driven item
*/

/*
	UI: Tooltip
	
	@export
		show
		hide
*/

smdui.protoUI({
	name:"tooltip",
	defaults:{
		dy:0,
		dx:20
	},
	$init:function(container){
		if (typeof container == "string"){
			container = { template:container };
		}

		this.type = smdui.extend({}, this.type);

		//create  container for future tooltip
		this.$view = this._viewobj = this._contentobj = this._dataobj = smdui.html.create("DIV", {role:"alert", "aria-atomic":"true"});
		this._contentobj.className = "smdui_tooltip";
		smdui.html.insertBefore(this._contentobj,document.body.firstChild,document.body);
		this._hideHandler = smdui.attachEvent("onClick", smdui.bind(function(e){
			if (this._visible && smdui.$$(e) != this)
				this.hide();
		}, this));
		
		//detach global event handler on destruction
		this.attachEvent("onDestruct", function(){
			smdui.detachEvent(this._hideHandler);
		});
	},
	adjust:function(){  },
	//show tooptip
	//pos - object, pos.x - left, pox.y - top
    isVisible:function(){
        return true;
    },
	show:function(data,pos){
		if (this._disabled) return;
		//render sefl only if new data was provided
		if (this.data!=data){
			this.data=smdui.extend({},data);
			this.render(data);
		}

		if (this._dataobj.firstChild){
			//show at specified position
			var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
			var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
			var positionX = w - pos.x;
			var positionY = h - pos.y;

			this._contentobj.style.display="block";
			
			if(positionX - this._settings.dx > this._contentobj.offsetWidth)
				positionX = pos.x;
			else {
				positionX = (pos.x - (this._settings.dx * 2)) - this._contentobj.offsetWidth;
				if(positionX <= 0) positionX = 0;
			}

			if(positionY - this._settings.dy > this._contentobj.offsetHeight)
				positionY = pos.y;
			else 
				positionY = (pos.y - this._settings.dy) - this._contentobj.offsetHeight;
			this._contentobj.style.left = positionX+this._settings.dx+"px";
			this._contentobj.style.top = positionY+this._settings.dy+"px";
		}
		this._visible = true;
	},
	//hide tooltip
	hide:function(){
		this.data=null; //nulify, to be sure that on next show it will be fresh-rendered
		this._contentobj.style.display="none";
		this._visible = false;
	},
	disable:function(){
		this._disabled = true;
	},
	enable:function(){
		this._disabled = false;
	},
	type:{
		template:smdui.template("{obj.id}"),
        templateStart:smdui.template.empty,
	    templateEnd:smdui.template.empty
	}

}, smdui.SingleRender, smdui.Settings, smdui.EventSystem, smdui.ui.view);
		
smdui.AutoTooltip = {
	tooltip_setter:function(value){
		if (value){
			if (typeof value == "function")
				value = { template:value };

			var col_mode = !value.template;
			var t = new smdui.ui.tooltip(value);
			this._enable_mouse_move();
			var showEvent = this.attachEvent("onMouseMove",function(id,e){	//show tooltip on mousemove
				this._mouseEventX = e.clientX;
				this._mouseEventY = e.clientY;
				if (this.getColumnConfig){
					var config = t.type.column = this.getColumnConfig(id.column);
					if (col_mode){
						//empty tooltip - ignoring
						if (!config.tooltip && config.tooltip != smdui.undefined)
							return;
						var trg = e.target || e.srcElements;

						if(trg.getAttribute("smdui_area") && config.tooltip){
							var area = trg.getAttribute("smdui_area");
							t.type.template = function(obj,common){
								var values = obj[common.column.id];
								return smdui.template(config.tooltip).call(this,obj,common,values[area],area);
							};
						}
						else{
							if (config.tooltip)
								t.type.template = config.tooltip = smdui.template(config.tooltip);
							else {
								var text = this.getText(id.row, id.column);
								t.type.template = function(){ return text; };
							}
						}
					}
				}

				if (!smdui.DragControl.active)
					t.show(this.getItem(id),smdui.html.pos(e));
			});
			// [[IMPROVE]]  As we can can have only one instance of tooltip per page 
			//				this handler can be attached once per page, not once per component
			var hideEvent = smdui.event(document.body, "mousemove", smdui.bind(function(e){
				e = e||event;
				if(this._mouseEventX != e.clientX || this._mouseEventY != e.clientY)
					t.hide();
			},this));
			this.attachEvent("onDestruct",function(){
				if(this.config.tooltip)
					this.config.tooltip.destructor();
			});
			this.attachEvent("onAfterScroll", function(){
				t.hide();
			});
			t.attachEvent("onDestruct",smdui.bind(function(){
				this.detachEvent(showEvent);
				smdui.eventRemove(hideEvent);
			},this));
			return t;
		}
	}
};

smdui.protoUI({
	name:"proto",
	$init:function(){
		this.data.provideApi(this, true);
		this._dataobj = this._dataobj || this._contentobj;
		
		//render self , each time when data is updated
		this.data.attachEvent("onStoreUpdated",smdui.bind(function(){
			this.render.apply(this,arguments);
		},this));
	},
	$setSize:function(){
		if (smdui.ui.view.prototype.$setSize.apply(this, arguments))
			this.render();
	},
	_id:"smdui_item",
	on_mouse_move:{
	},
	type:{}
}, smdui.PagingAbility, smdui.DataMarks, smdui.AutoTooltip,smdui.ValidateCollection,smdui.RenderStack, smdui.DataLoader, smdui.ui.view, smdui.EventSystem, smdui.Settings);

smdui.CodeParser = {
	//converts a complex object into an object with primitives properties
	collapseNames:function(base, prefix, data){
		data = data || {};
		prefix = prefix || "";

		if(!base || typeof base != "object")
			return null;

		for(var prop in base){
			if(base[prop] && typeof base[prop] == "object" && !smdui.isDate(base[prop]) && !smdui.isArray(base[prop])){
				smdui.CodeParser.collapseNames(base[prop], prefix+prop+".", data);
			} else {
				data[prefix+prop] = base[prop];
			}
		}
		return data;
	},
	//converts an object with primitive properties into an object with complex properties
	expandNames:function(base){
		var data = {},
			i, lastIndex, name, obj, prop;

		for(prop in base){
			name = prop.split(".");
			lastIndex = name.length-1;
			obj = data;
			for( i =0; i < lastIndex; i++ ){
				if(!obj[name[i]])
					obj[name[i]]  = {};
				obj = obj[name[i]];
			}
			obj[name[lastIndex]] = base[prop];
		}

		return data;
	}
};

smdui.Values = {
	$init:function(){
		this.elements = {};
	},
	focus:function(name){
		if (name){
			smdui.assert(this.elements[name],"unknown input name: "+name);
			this._focus(this.elements[name]);
		} else{
			for(var n in this.elements){
				if(this._focus(this.elements[n]))
					return true;
			}
		}
	},
	_focus: function(target){
		if (target && target.focus){
			target.focus();
			return true;
		}
	},
	setValues:function(data, update){
		if (this._settings.complexData)
			data = smdui.CodeParser.collapseNames(data);

		this._inner_setValues(data, update);
	},
	_inner_setValues:function(data, update){
		this._is_form_dirty = update;
		//prevent onChange calls from separate controls
		this.blockEvent();

		if (!update || !this._values)
			this._values = {};

		if (smdui.debug_render)
			smdui.log("Render: "+this.name+"@"+this._settings.id);

		for (var name in data)
			if (!this.elements[name])
				this._values[name] = data[name];

		for (var name in this.elements){
			var input = this.elements[name];
			if (input){
				if (!smdui.isUndefined(data[name]))
					input.setValue(data[name]);
				else if (!update && input._allowsClear)
					input.setValue("");
				this._values[name] = input.getValue();
			}
		}

		this.unblockEvent();
		this.callEvent("onValues",[]);
	},
	isDirty:function(){
		if (this._is_form_dirty) return true;
		if (this.getDirtyValues(1) === 1)
			return true;

		return false;
	},
	setDirty:function(flag){
		this._is_form_dirty = flag;
		if (!flag)
			this._values = this._inner_getValues();
	},
	getDirtyValues:function(){
		var result = {};
		if (this._values){
			for (var name in this.elements){
				var value = this.elements[name].getValue();
				if (this._values[name] != value){
					result[name] = value;
					//FIXME - used by isDirty
					if (arguments[0])
						return 1;
				}
			}
		}
		return result;
	},
	getCleanValues:function(){
		return this._values;
	},
	getValues:function(filter){
		var data = this._inner_getValues(filter);
		if (this._settings.complexData)
			data = smdui.CodeParser.expandNames(data);

		return data;
	},
	_inner_getValues:function(filter){
		//get original data		
		var success,
			elem = null,
			data = (this._values?smdui.copy(this._values):{});

		//update properties from linked controls
		for (var name in this.elements){
			elem = this.elements[name];
			success = true;
			if(filter){
				if(typeof filter == "object"){
					if(filter.hidden === false)
						success = elem.isVisible();
					if(success && filter.disabled === false)
						success = elem.isEnabled();
				}
				else
					success = filter.call(this,elem);
			}
			if(success)
				data[name] = elem.getValue();
			else
				delete data[name]; //in case of this._values[name]
		}
		return data;
	},
	clear:function(){
		this._is_form_dirty = false;
		var data = {};
		for (var name in this.elements)
			if (this.elements[name]._allowsClear)
				data[name] = this.elements[name]._settings.defaultValue||"";
		
		this._inner_setValues(data);
	},
	markInvalid: function(name, state){
		// remove 'invalid' mark
		if(state === false){
			this._clear_invalid(name);
		}
		// add 'invalid' mark
		else{
			// set invalidMessage
			if(typeof state == "string"){
				var input = this.elements[name];
				if(input)
					input._settings.invalidMessage = state;
			}
			this._mark_invalid(name);
		}
	},
	_mark_invalid:function(id){
		var input = this.elements[id];
		if (id && input){
			this._clear_invalid(id,true);
			smdui.html.addCss(input._viewobj, "smdui_invalid");
			input._settings.invalid = true;
			var message = input._settings.invalidMessage;
			if(typeof message === "string" && input.setBottomText)
				input.setBottomText();
		}
	},
	_clear_invalid:function(id,silent){
		var input = this.elements[id];
        if(id && input && input.$view && input._settings.invalid){
	        smdui.html.removeCss(input._viewobj, "smdui_invalid");
	        input._settings.invalid = false;
	        var message = input._settings.invalidMessage;
	        if(typeof message === "string" && !silent && input.setBottomText)
	        	input.setBottomText();
        }
	}
};

smdui.protoUI({
	name:"toolbar",
	defaults:{
		type:'toolbar'
	},
	_render_borders:true,
	_form_classname:"smdui_toolbar",
	_form_vertical:false,
	$init:function(config){
		if (!config.borderless)
			this._contentobj.style.borderWidth="1px";

		this._contentobj.className+=" "+this._form_classname;
		this._viewobj.setAttribute("role", "toolbar");
	},
	_recollect_elements:function(){
		var form = this;
		form.elements = {};
		smdui.ui.each(this, function(view){
			if (view._settings.name && view.getValue && view.setValue){
				form.elements[view._settings.name] = view;
				if (view.mapEvent)
					view.mapEvent({
						onbeforetabclick:form,
						onaftertabclick:form,
						onitemclick:form,
						onchange:form
					});
			}

			if (view.setValues) return false;
		});
		this.setDirty(false);
	},
	_parse_cells_ext_end:function(){
		this._recollect_elements();
	},
	_parse_cells_ext:function(collection){
		var config = this._settings;
		if (config.elements && !collection){
			this._collection = collection = config.elements;
			this._vertical_orientation = this._form_vertical;
			delete config.elements;
		}

		if (this._settings.elementsConfig)
			this._rec_apply_settings(this._collection, config.elementsConfig);
		
		return collection;
	},
	_rec_apply_settings:function(col, settings){
		for (var i=0; i<col.length; i++){
			var element = col[i];
			smdui.extend( element, settings );
			var nextsettings = settings;

			if (element.elementsConfig)
				nextsettings = smdui.extend(smdui.extend({}, element.elementsConfig), settings);

			var sub;
			if (element.body)
				sub = [element.body];
			else
				sub = element.rows || element.cols || element.cells || element.body;

			if (sub)
				this._rec_apply_settings(sub, nextsettings);
		}
	},
	$getSize:function(dx, dy){
		var sizes = smdui.ui.layout.prototype.$getSize.call(this, dx, dy);
		var parent = this.getParentView();
		var index = this._vertical_orientation?3:1;
		if (parent && this._vertical_orientation != parent._vertical_orientation)
			sizes[index]+=100000;
		
		smdui.debug_size_box(this, sizes, true);
		return sizes;
	},
	render:function(){
	},
	refresh:function(){
		this.render();
	}
},  smdui.Scrollable, smdui.AtomDataLoader, smdui.Values, smdui.ui.layout, smdui.ValidateData);

smdui.protoUI({
	name:"template",
	$init:function(config){
		var subtype = this._template_types[config.type];
		if (subtype){
			smdui.extend(config, subtype);
			
			//will reset borders for "section"
			if (config.borderless){
				delete config._inner;
				this._set_inner(config);
			}
		}

		if (this._dataobj == this._viewobj){
			this._dataobj = smdui.html.create("DIV");
			this._dataobj.className = " smdui_template";
			this._viewobj.appendChild(this._dataobj);
		} else 
			this._dataobj.className += " smdui_template";

		this.attachEvent("onAfterRender", this._correct_width_scroll);
	},
	setValues:function(obj, update){
		this.data = update?smdui.extend(this.data, obj, true):obj;
		this.render();
	},
	getValues:function(){
		return this.data;
	},
	$skin:function(){
		this._template_types.header.height = this._template_types.section.height = smdui.skin.$active.barHeight;
	},
	_template_types:{
		"header":{
			css:"smdui_header"
		},
		"section":{
			css:"smdui_section",
			borderless:true
		},
		"clean":{
			css:"smdui_clean",
			borderless:true
		}
	},
	onClick_setter:function(value){
		this.on_click = smdui.extend((this.on_click || {}), value, true);

		if (!this._onClick)
			smdui.extend(this, smdui.MouseEvents);

		return value;
	},
	defaults:{
		template:smdui.template.empty
	},
	_render_me:function(){
		this._not_render_me = false;
		this._probably_render_me();
		this.resize();
	},
	_probably_render_me:function(){
		if (!this._not_render_me){
			this._not_render_me = true;
			this.render();
		}
	},
	src_setter:function(value){
		this._not_render_me = true;
		
		if(!this.callEvent("onBeforeLoad",[])) 
			return "";
		smdui.ajax(value, smdui.bind(function(text){
			this._settings.template = smdui.template(text);
			this._render_me();
			this.callEvent("onAfterLoad",[]);
		}, this));
		return value;
	},
	_correct_width_scroll:function(){
		//we need to force auto height calculation after content change
		//dropping the last_size flag will ensure that inner logic of $setSize will be processed
		if (this._settings.autoheight){
			this._last_size = null;
			this.resize();
		}

		if (this._settings.scroll && this._settings.scroll.indexOf("x") != -1)
			this._dataobj.style.width = this._dataobj.scrollWidth + "px";
	},
	content_setter:function(config){
		if (config){
			this._not_render_me = true;
			this.render = function(){};
			this._dataobj.appendChild(smdui.toNode(config));
		}
	},
	refresh:function(){
		this.render();
	},
	setHTML:function(html){
		this._settings.template = function(){ return html; };
		this.refresh();
	},
	setContent:function(content){
		this._dataobj.innerHTML = "";
		this.content_setter(content);
	},
	$setSize:function(x,y){
		if (smdui.ui.view.prototype.$setSize.call(this,x,y)){
			this._probably_render_me();
			if (this._settings.autoheight){
				var top =this.getTopParentView();
				clearTimeout(top._template_resize_timer);
				top._template_resize_timer = smdui.delay(this.resize, this);
			}
			return true;
		}
	},
	$getSize:function(x,y){
		if (this._settings.autoheight && !this._settings.type)
			this._settings.height = this._get_auto_height();

		return smdui.ui.view.prototype.$getSize.call(this,x,y);
	},
	_get_auto_height:function(){
		var size;
			
		this._probably_render_me();
		var padding = smdui.skin.$active.layoutPadding.space;
		this._dataobj.style.height = "auto";
		size = this._dataobj.scrollHeight;
		this._dataobj.style.height = "";

		return size;
	},
	_one_time_scroll:true //scroll will appear only if set directly in config
}, smdui.Scrollable, smdui.AtomDataLoader, smdui.AtomRender, smdui.EventSystem, smdui.ui.view);

smdui.protoUI({
	name:"iframe",
	$init:function(config){
		this._dataobj = this._contentobj;
		this._contentobj.innerHTML = "<iframe style='width:100%; height:100%' frameborder='0' onload='var t = $$(this.parentNode.getAttribute(\"view_id\")); if (t) t.callEvent(\"onAfterLoad\",[]);' src='about:blank'></iframe>";
	},
	load:function(value){
		this.src_setter(value);
	},
	src_setter:function(value){
		if(!this.callEvent("onBeforeLoad",[])) 
			return "";
		this.getIframe().src = value;
		return value;
	},
	getIframe:function(){
		return this._contentobj.getElementsByTagName("iframe")[0];
	},
	getWindow:function(){
		return this.getIframe().contentWindow;
	}
}, smdui.ui.view, smdui.EventSystem);

smdui.OverlayBox = {
	showOverlay:function(message){
		if (!this._overlay){
			this._overlay = smdui.html.create("DIV",{ "class":"smdui_overlay" },(message||""));
			smdui.html.insertBefore(this._overlay, this._viewobj.firstChild, this._viewobj);
			this._viewobj.style.position = "relative";
		} else 
			this._overlay.innerHTML = message;
	},
	hideOverlay:function(){
		if (this._overlay){
			smdui.html.remove(this._overlay);
			this._overlay = null;
		}
	}
};

/*scrollable view with another view insize*/
smdui.protoUI({
	name:"scrollview",
	defaults:{
		scroll:"y",
		scrollSpeed:"0ms"
	},
	$init:function(){
		this._viewobj.className += " smdui_scrollview";
	},
	body_setter:function(config){
		config.borderless = true;
		this._body_cell = smdui.ui._view(config);
		this._body_cell._parent_cell = this;
		this._dataobj.appendChild(this._body_cell._viewobj);
	},
	getChildViews:function(){
		return [this._body_cell];
	},
	getBody:function(){
		return this._body_cell;
	},
	resizeChildren:function(){
		this._desired_size = this._body_cell.$getSize(0, 0);
		this._resizeChildren();
		smdui.callEvent("onResize",[]);
	},
	_resizeChildren:function(){
		var scroll_size = this._native_scroll || smdui.ui.scrollSize;
		var cx = Math.max(this._content_width, this._desired_size[0]);
		var cy = Math.max(this._content_height, this._desired_size[2]);
		this._body_cell.$setSize(cx, cy);			
		this._dataobj.style.width = this._body_cell._content_width+"px";
		this._dataobj.style.height = this._body_cell._content_height+"px";
		if (smdui.env.touch){
			var state = this.getScrollState();
			var top = this._body_cell._content_height - this._content_height;
			if (top < state.y)
				this.scrollTo(null, top);
		}
		if (smdui._responsive_exception){
			smdui._responsive_exception = false;
			this._desired_size = this._body_cell.$getSize(0, 0);
			this._resizeChildren();
		}
	},
	$getSize:function(dx, dy){
		var desired_size = this._desired_size = this._body_cell.$getSize(0, 0);
		var self_sizes   = smdui.ui.view.prototype.$getSize.call(this, dx, dy);
		var scroll_size = this._native_scroll || smdui.ui.scrollSize;

		if(this._settings.scroll=="x"){
			self_sizes[2] = Math.max(self_sizes[2], desired_size[2]) + scroll_size;
			self_sizes[3] = Math.min(self_sizes[3], desired_size[3]) + scroll_size;
		} else if(this._settings.scroll=="y"){
			self_sizes[0] = Math.max(self_sizes[0], desired_size[0]) + scroll_size;
			self_sizes[1] = Math.min(self_sizes[1], desired_size[1]) + scroll_size;
		}
		return self_sizes;
	},
	$setSize:function(x,y){
		var temp = smdui.ui.scrollSize;
		smdui.ui.scrollSize = this._native_scroll || temp;

		if (smdui.ui.view.prototype.$setSize.call(this,x,y))
			this._resizeChildren();
		
		smdui.ui.scrollSize = temp;
	},
	scroll_setter:function(value){
		var custom = smdui.env.$customScroll;
		if (typeof value == "string" && value.indexOf("native-") === 0){
			this._native_scroll = 17;
			value = value.replace("native-");
			smdui.env.$customScroll = false;
		}

		value =  smdui.Scrollable.scroll_setter.call(this, value);

		smdui.env.$customScroll = custom;
		return value;
	},
	_replace:function(new_view){
		this._body_cell.destructor();
		this._body_cell = new_view;
		this._body_cell._parent_cell = this;
		
		this._bodyobj.appendChild(this._body_cell._viewobj);
		this.resize();
	},
	showView: function(id){
		var topPos = smdui.$$(id).$view.offsetTop-smdui.$$(id).$view.parentNode.offsetTop;
		this.scrollTo(0, topPos);
	}
}, smdui.Scrollable, smdui.EventSystem, smdui.ui.view);

/*
	Behavior:SelectionModel - manage selection states
	@export
		select
		unselect
		selectAll
		unselectAll
		isSelected
		getSelectedId
*/
smdui.SelectionModel={
	$init:function(){
		//collection of selected IDs
		this._selected = smdui.toArray();
		smdui.assert(this.data, "SelectionModel :: Component doesn't have DataStore");
         	
		//remove selection from deleted items
		this.data.attachEvent("onStoreUpdated",smdui.bind(this._data_updated,this));
		this.data.attachEvent("onStoreLoad", smdui.bind(this._data_loaded,this));
		this.data.attachEvent("onAfterFilter", smdui.bind(this._data_filtered,this));
		this.data.attachEvent("onSyncApply", smdui.bind(this._select_check,this));
		this.data.attachEvent("onIdChange", smdui.bind(this._id_changed,this));
		this.$ready.push(this._set_noselect);
	},
	_set_noselect: function(){
		if (this._settings.select=="multiselect" || this._settings.multiselect)
			smdui._event(this.$view,"mousedown", function(e){
				var shiftKey = (e||event).shiftKey;
				if(shiftKey){
					smdui._noselect_element = this;
					smdui.html.addCss(this,"smdui_noselect",1);
				}
			});
	},
	_id_changed:function(oldid, newid){
		for (var i = this._selected.length - 1; i >= 0; i--)
			if (this._selected[i]==oldid)
				this._selected[i]=newid;
	},
	_data_filtered:function(){
		for (var i = this._selected.length - 1; i >= 0; i--){
			if (this.data.getIndexById(this._selected[i]) < 0) {
				var id = this._selected[i];
				this.removeCss(id, "smdui_selected", true);
				this._selected.splice(i,1);
				this.callEvent("onSelectChange",[id]);
			}
		}
	},
	//helper - linked to onStoreUpdated
	_data_updated:function(id,obj,type){
		if (type == "delete"){				//remove selection from deleted items
			if (this.loadBranch){
				//hierarchy, need to check all
				this._select_check();
			} else
				this._selected.remove(id);
		}
		else if (!id && !this.data.count() && !this.data._filter_order){	//remove selection for clearAll
			this._selected = smdui.toArray();
		}
	},
	_data_loaded:function(){
		if (this._settings.select)
			this.data.each(function(obj){
				if (obj && obj.$selected) this.select(obj.id);
			}, this);
	},
	_select_check:function(){
		for (var i = this._selected.length - 1; i >= 0; i--)
			if (!this.exists(this._selected[i]))
				this._selected.splice(i,1);
	},
	//helper - changes state of selection for some item
	_select_mark:function(id,state,refresh,need_unselect){
		var name = state ? "onBeforeSelect" : "onBeforeUnSelect";
		if (!this.callEvent(name,[id,state])) return false;

		if (need_unselect){
			this._silent_selection = true;
			this.unselectAll();
			this._silent_selection = false;
		}
		
		if (state)
			this.addCss(id, "smdui_selected", true);
		else
			this.removeCss(id, "smdui_selected", true);

		if (refresh)
			refresh.push(id);				//if we in the mass-select mode - collect all changed IDs
		else{
			if (state)
				this._selected.push(id);		//then add to list of selected items
			else
				this._selected.remove(id);
			this._refresh_selection(id);	//othervise trigger repainting
		}

		var name = state ? "onAfterSelect" : "onAfterUnSelect";
		this.callEvent(name,[id]);

		return true;
	},
	//select some item
	select:function(id,preserve){
		var ctrlKey = arguments[2];
		var shiftKey = arguments[3];
		//if id not provide - works as selectAll
		if (!id) return this.selectAll();

		//allow an array of ids as parameter
		if (smdui.isArray(id)){
			for (var i=0; i < id.length; i++)
				this.select(id[i], (i?1:preserve), ctrlKey, shiftKey);
			return;
		}

		smdui.assert(this.data.exists(id), "Incorrect id in select command: "+id);
		
		//block selection mode
		if (shiftKey && this._selected.length)
			return this.selectAll(this._selected[this._selected.length-1],id);

		//single selection mode
		var need_unselect = false;
		if (!ctrlKey && !preserve && (this._selected.length!=1 || this._selected[0]!=id))
			need_unselect = true;

		if (!need_unselect && this.isSelected(id)){
			if (ctrlKey) this.unselect(id);	//ctrl-selection of already selected item
			return;
		}

		this._select_mark(id, true, null, need_unselect);
	},
	//unselect some item
	unselect:function(id){
		//if id is not provided  - unselect all items
		if (!id) return this.unselectAll();
		if (!this.isSelected(id)) return;
		
		this._select_mark(id,false);
	},
	//select all items, or all in defined range
	selectAll:function(from,to){
		var range;
		var refresh=[];
		
		if (from||to)
			range = this.data.getRange(from||null,to||null);	//get limited set if bounds defined
		else
			range = this.data.getRange();			//get all items in other case
												//in case of paging - it will be current page only
		range.each(function(obj){ 
			if (!this.data.getMark(obj.id, "smdui_selected")){
				this._selected.push(obj.id);	
				this._select_mark(obj.id,true,refresh);
			}
		},this);
		//repaint self
		this._refresh_selection(refresh);
	},
	//remove selection from all items
	unselectAll:function(){
		var refresh=[];
		
		this._selected.each(function(id){
			this._select_mark(id,false,refresh);	//unmark selected only
		},this);
		
		this._selected=smdui.toArray();
		this._refresh_selection(refresh);	//repaint self
	},
	//returns true if item is selected
	isSelected:function(id){
		return this._selected.find(id)!=-1;
	},
	/*
		returns ID of selected items or array of IDs
		to make result predictable - as_array can be used, 
			with such flag command will always return an array 
			empty array in case when no item was selected
	*/
	getSelectedId:function(as_array){	
		switch(this._selected.length){
			case 0: return as_array?[]:"";
			case 1: return as_array?[this._selected[0]]:this._selected[0];
			default: return ([].concat(this._selected)); //isolation
		}
	},
	getSelectedItem:function(as_array){
		var sel = this.getSelectedId(true);
		if (sel.length > 1 || as_array){
			for (var i = sel.length - 1; i >= 0; i--)
				sel[i] = this.getItem(sel[i]);
			return sel;
		} else if (sel.length)
			return this.getItem(sel[0]);
	},
	//detects which repainting mode need to be used
	_is_mass_selection:function(obj){
		 // crappy heuristic, but will do the job
		return obj.length>100 || obj.length > this.data.count/2;
	},
	_refresh_selection:function(refresh){
		if (typeof refresh != "object") refresh = [refresh];
		if (!refresh.length) return;	//nothing to repaint
		
		if (this._is_mass_selection(refresh))	
			this.data.refresh();	//many items was selected - repaint whole view
		else
			for (var i=0; i < refresh.length; i++)	//repaint only selected
				this.render(refresh[i],this.data.getItem(refresh[i]),"update");
			
		if (!this._silent_selection)	
		this.callEvent("onSelectChange",[refresh]);
	}
};

smdui.ready(function(){
	smdui.event(document.body,"mouseup", function(e){
		if(smdui._noselect_element){
			smdui.html.removeCss(smdui._noselect_element,"smdui_noselect");
			smdui._noselect_element = null;
		}
	});
});


/*
	Behavior:DragItem - adds ability to move items by dnd
	
	dnd context can have next properties
		from - source object
		to - target object
		source - id of dragged item(s)
		target - id of drop target, null for drop on empty space
		start - id from which DND was started
*/
smdui.AutoScroll = {
	_auto_scroll:function(pos, id){
		var yscroll = 1;
		var xscroll = 0;

		var scroll = this._settings.dragscroll;
		if (typeof scroll == "string"){
			xscroll = scroll.indexOf("x") != -1;
			yscroll = scroll.indexOf("y") != -1;
		}

		var data = this._body || this.$view;
		var box = smdui.html.offset(data);

		var top = box.y;
		var bottom = top + data.offsetHeight;
		var left = box.x;
		var right = left + data.offsetWidth;

		var scroll = this.getScrollState();
		var reset = false;
		var sense = Math.max(this.type&&!isNaN(parseFloat(this.type.height))?this.type.height+5:0,40); //dnd auto-scroll sensivity

		if (yscroll){
			var config = this._settings;
			if(config.topSplit){
				var topSplitPos = this._cellPosition(this.getIdByIndex(config.topSplit-1), this.columnId(0));
				top += topSplitPos.top + topSplitPos.height;
			}

			if (pos.y < (top + sense)){
				this._auto_scrollTo(scroll.x, scroll.y-sense*2, pos);
				reset = true;
			} else if (pos.y > bottom - sense){
				this._auto_scrollTo(scroll.x, scroll.y+sense*2, pos);
				reset = true;
			}
		}

		if (xscroll){
			if (pos.x < (left + sense)){
				this._auto_scrollTo(scroll.x-sense*2, scroll.y, pos);
				reset = true;
			} else if (pos.x > right - sense){
				this._auto_scrollTo(scroll.x+sense*2, scroll.y, pos);
				reset = true;
			}
		}

		if (reset)
			this._auto_scroll_delay = smdui.delay(this._auto_scroll, this, [pos], 100);

	},
	_auto_scrollTo: function(x,y,pos){
		if(this.callEvent("onBeforeAutoScroll",[pos]))
			this.scrollTo(x,y);
	}
};

smdui.DragOrder={
	_do_not_drag_selection:true,
	$drag:function(s,e){
		var html = smdui.DragItem.$drag.call(this,s,e);
		if (html){
			var context = smdui.DragControl.getContext(); 
			if (this.getBranchIndex)
				this._drag_order_stored_left = this._drag_order_complex?((this.getItem(context.start).$level) * 16):0;
			if (!context.fragile)
				this.addCss(context.start, "smdui_transparent");
		}
		return html;
	},
	_getDragItemPos: function(pos,e){
		return smdui.DragItem._getDragItemPos(pos,e);
	},
	$dragPos:function(pos,e, node){
		var box = smdui.html.offset(this.$view);
		var left = box.x + (this._drag_order_complex?( 1+this._drag_order_stored_left):1);
		var top = pos.y;
		var config = this._settings;
		var xdrag = (config.layout == "x");

		if (xdrag){
			top = box.y + (this._drag_order_complex?( + box.height - smdui.ui.scrollSize - 1):1);
			left = pos.x;
		}

		node.style.display = 'none';

		var html = document.elementFromPoint(left, top);

		if (html != this._last_sort_dnd_node){
			var view = smdui.$$(html);
			//this type of dnd is limited to the self
			if (view && view == this){
				var id = this.locate(html, true);
				// sometimes 'mousedown' on item is followed by 'mousemove' on empty area and item caanot be located
				if(!id && smdui.DragControl._saved_event)
					id = this.locate(smdui.DragControl._saved_event, true);
				
				var start_id = smdui.DragControl.getContext().start;
				this._auto_scroll_force = true;
				if (id){

					if (id != this._last_sort_dnd_node){
						if (id != start_id){
							var details, index;

							if (this.getBranchIndex){
								details = { parent:this.getParentId(id) }; 
								index = this.getBranchIndex(id);
							} else {
								details = {};
								index = this.getIndexById(id);
							}

							if (this.callEvent("onBeforeDropOrder",[start_id, index, e, details])){
								this.move(start_id, index, this, details);
								this._last_sort_dnd_node = id;
							}
						}
						smdui.DragControl._last = this._contentobj;
					}
				}
				else {
					id = "$smdui-last";
					if (this._last_sort_dnd_node != id){
						if (!this.callEvent("onBeforeDropOrder",[start_id, -1, e, { parent: 0} ])) return;
						this._last_sort_dnd_node  = id;
					}
				}
			}
		}

		node.style.display = 'block';

		
		if (xdrag){
			pos.y = box.y;
			pos.x = pos.x-18;

			if (pos.x < box.x)
				pos.x = box.x; 
			else {
				var max = box.x + this.$view.offsetWidth - 60;
				if (pos.x > max)
					pos.x = max;
			}
		} else {
			box.y += this._header_height;
			pos.x = this._drag_order_stored_left||box.x;
			pos.y = pos.y-18;
		
			if (pos.y < box.y)
				pos.y = box.y; 
			else {
				var max = box.y + this.$view.offsetHeight - 60;
				if (pos.y > max)
					pos.y = max;
			}
		}

		if (this._auto_scroll_delay)
			this._auto_scroll_delay = window.clearTimeout(this._auto_scroll_delay);

		this._auto_scroll_delay = smdui.delay(this._auto_scroll, this, [smdui.html.pos(e), this.locate(e) || null],250);

		//prevent normal dnd landing checking
		smdui.DragControl._skip = true;
	},
	$dragIn:function(){
		return false;
	},
	$drop:function(s,t,e){
		if (this._auto_scroll_delay){
			this._auto_scroll_force = null;
			this._auto_scroll_delay = window.clearTimeout(this._auto_scroll_delay);
		}

		var context = smdui.DragControl.getContext();
		var id = context.start;
		this.removeCss(id, "smdui_transparent");

		var index = this.getIndexById(id);
		this.callEvent("onAfterDropOrder",[id, index , e]);
		if (context.fragile)
			this.refresh();
	}
};
smdui.DragItem={
	//helper - defines component's container as active zone for dragging and for dropping
	_initHandlers:function(obj, source, target){
		if (!source) smdui.DragControl.addDrop(obj._contentobj,obj,true);
		if (!target) smdui.DragControl.addDrag(obj._contentobj,obj);
		this.attachEvent("onDragOut",function(a,b){ this.$dragMark(a,b); });
		this.attachEvent("onBeforeAutoScroll",function(){
			var context = smdui.DragControl.getContext();
			return !!(smdui.DragControl._active && context && (context.to === this || this._auto_scroll_force));
		});
	},
	drag_setter:function(value){
		if (value){
			smdui.extend(this, smdui.AutoScroll, true);
			if (value == "order")
				smdui.extend(this, smdui.DragOrder, true);
			if (value == "inner")
				this._inner_drag_only = true;

			this._initHandlers(this, value == "source", value == "target");
			delete this.drag_setter;	//prevent double initialization
		}
		return value;
	},
	/*
		s - source html element
		t - target html element
		d - drop-on html element ( can be not equal to the target )
		e - native html event 
	*/
	//called when drag moved over possible target
	$dragIn:function(s,t,e){
		var id = this.locate(e) || null;
		var context = smdui.DragControl._drag_context;

		//in inner drag mode - ignore dnd from other components
		if ((this._inner_drag_only || context.from._inner_drag_only) && context.from !== this) return false;

		var to = smdui.DragControl.getMaster(t);
		//previous target
		var html = (this.getItemNode(id, e)||this._dataobj);
		//prevent double processing of same target
		if (html == smdui.DragControl._landing) return html;
		context.target = id;
		context.to = to;

		if (this._auto_scroll_delay)
			this._auto_scroll_delay = window.clearTimeout(this._auto_scroll_delay);

		this._auto_scroll_delay = smdui.delay(function(pos,id){
			this._drag_pause(id);
			this._auto_scroll(pos,id);
		}, this, [smdui.html.pos(e), id], 250);

		if (!this.$dropAllow(context, e)  || !this.callEvent("onBeforeDragIn",[context, e])){
			context.to = context.target = null;
			if (this._auto_scroll_delay)
				this._auto_scroll_delay = window.clearTimeout(this._auto_scroll_delay);
			return null;
		}
		//mark target only when landing confirmed
		this.$dragMark(context,e);
		return html;
	},
	$dropAllow:function(){
		return true;
	},
	_drag_pause:function(id){
		//may be reimplemented in some components
		// tree for example
	},
	_target_to_id:function(target){
		return target && typeof target === "object" ? target.toString() : target;
	},
	//called when drag moved out from possible target
	$dragOut:function(s,t,n,e){ 
		var id = (this._viewobj.contains(n) ? this.locate(e): null) || null;
		var context = smdui.DragControl._drag_context;

		//still over previous target
		if ((context.target||"").toString() == (id||"").toString()) return null;
		if (this._auto_scroll_delay){
			this._auto_scroll_force = null;
			this._auto_scroll_delay = window.clearTimeout(this._auto_scroll_delay);
		}

		//unmark previous target
		context.target = context.to = null;
		this.callEvent("onDragOut",[context,e]);
		return null;
	},
	//called when drag moved on target and button is released
	$drop:function(s,t,e){ 
		if (this._auto_scroll_delay)
			this._auto_scroll_delay = window.clearTimeout(this._auto_scroll_delay);

		var context = smdui.DragControl._drag_context;
		//finalize context details
		context.to = this;
		var target = this._target_to_id(context.target);

		if (this.getBranchIndex){
			if (target){
				context.parent = this.getParentId(target);
				context.index = this.getBranchIndex(target);
			}
		} else
			context.index = target?this.getIndexById(target):this.count();

		//unmark last target
		this.$dragMark({}, e);

		if( context.from && context.from != context.to && context.from.callEvent ){
			context.from.callEvent("onBeforeDropOut", [context,e]);
		}

		if (!this.callEvent("onBeforeDrop",[context,e])) return;
		//moving
		this._context_to_move(context,e);
		
		this.callEvent("onAfterDrop",[context,e]);
	},
	_context_to_move:function(context,e){
		smdui.assert(context.from, "Unsopported d-n-d combination");
		if (context.from){	//from different component
			var details = { parent: context.parent, mode: context.pos };
			context.from.move(context.source,context.index,context.to, details);
		}
	},
	_getDragItemPos: function(pos,e){
		if (this.getItemNode){
			var id = this.locate(e, true);
			//in some case, node may be outiside of dom ( spans in datatable for example )
			//so getItemNode can return null
			var node = id ? this.getItemNode(id) : null;
			return node ? smdui.html.offset(node) : node;
		}
	},
	//called when drag action started
	$drag:function(s,e){
		var id = this.locate(e, true);
		if (id){
			var list = [id];

			if (this.getSelectedId && !this._do_not_drag_selection){ //has selection model
				//if dragged item is one of selected - drag all selected
				var selection = this.getSelectedId(true, true);	

				if (selection && selection.length > 1 && smdui.PowerArray.find.call(selection,id)!=-1){
					var hash = {}; 
					var list = [];
					for (var i=0;i<selection.length; i++)
						hash[selection[i]]=true;
					for (var i = 0; i<this.data.order.length; i++){
						var hash_id = this.data.order[i];
						if (hash[hash_id])
							list.push(hash_id);
					}
				}
			}
			//save initial dnd params
			var context = smdui.DragControl._drag_context= { source:list, start:id };
			context.fragile = (this.addRowCss && smdui.env.touch && ( smdui.env.isWebKit || smdui.env.isFF ));
			context.from = this;
			
			if (this.callEvent("onBeforeDrag",[context,e])){
				if (smdui.Touch)
					smdui.Touch._start_context = null;

				//set drag representation
				return context.html||this.$dragHTML(this.getItem(id), e);
			}
		}
		return null;
	},
	$dragHTML:function(obj, e){
		return this._toHTML(obj);
	},
	$dragMark:function(context, ev){
		var target = null;
		if (context.target)
			target = this._target_to_id(context.target);

		//touch webkit will stop touchmove event if source node removed
		//datatable can't repaint rows without repainting
		if (this._marked && this._marked != target){
			if (!context.fragile) this.removeCss(this._marked, "smdui_drag_over");
			this._marked = null;
		}

		if (!this._marked && target){
			this._marked = target;
			if (!context.fragile) this.addCss(target, "smdui_drag_over");
			return target;
		}
		
		if (context.to){
			return true;
		}else
			return false;
	}
};

smdui.Group = {
	$init:function(){
		smdui.extend(this.data, smdui.GroupStore);
		//in case of plain store we need to remove store original dataset
		this.data.attachEvent("onClearAll",smdui.bind(function(){
			this.data._not_grouped_order = this.data._not_grouped_pull = null;
			this._group_level_count = 0;
		},this));
	},
	group:function(config){
		this.data.ungroup(true);
		this.data.group(config);
	},
	ungroup:function(skipRender){
		this.data.ungroup(skipRender);
	}
};

smdui.GroupMethods = {
	sum:function(property, data){
		data = data || this;
		var summ = 0;
		for (var i = 0; i < data.length; i++)
			summ+=property(data[i])*1;

		return summ;
	},
	min:function(property, data){
		data = data || this;
		var min = Infinity;

		for (var i = 0; i < data.length; i++)
			if (property(data[i])*1 < min) min = property(data[i])*1;

		return min*1;
	},
	max:function(property, data){
		data = data || this;
		var max = -Infinity;

		for (var i = 0; i < data.length; i++)
			if (property(data[i])*1 > max) max = property(data[i])*1;

		return max*1;
	},
	count:function(property, data){
		var count = 0;
		for (var i = 0; i < data.length; i++) {
			var some = property(data[i]);
			if (some !== null && typeof some !== "undefined")
				count++;
		}
		return count;
	},
	any:function(property, data){
		return property(data[0]);
	},
	string:function(property, data){
		return property.$name;
	}
};

smdui.GroupStore = {
	$init:function(){
		this.attachEvent("onClearAll", this._reset_groups);
	},
	_reset_groups:function(){
		this._not_grouped_order = this._not_grouped_pull = null;
		this._group_level_count = 0;
	},
	ungroup:function(skipRender){
		if (this.getBranchIndex)
			return this._ungroup_tree.apply(this, arguments);

		if (this._not_grouped_order){
			this.order = this._not_grouped_order;
			this.pull = this._not_grouped_pull;
			this._not_grouped_pull = this._not_grouped_order = null;
			if(!skipRender)
				this.callEvent("onStoreUpdated",[]);
		}

	},
	_group_processing:function(scheme){
		this.blockEvent();
		this.group(scheme);
		this.unblockEvent();
	},
	_group_prop_accessor:function(val){
		if (typeof val == "function")
			return val;
		var acc = function(obj){ return obj[val]; };
		acc.$name = val;
		return acc;
	},	
	group:function(stats){ 
		if (this.getBranchIndex)
			return this._group_tree.apply(this, arguments);

		var key = this._group_prop_accessor(stats.by);
		if (!stats.map[key])
			stats.map[key] = [key, this._any];
			
		var groups = {};
		var labels = [];
		this.each(function(data){
			var current = key(data);
			if (!groups[current]){
				labels.push({ id:current, $group:true, $row:stats.row });
				groups[current] = smdui.toArray();
			}
			groups[current].push(data);
		});
		for (var prop in stats.map){
			var functor = (stats.map[prop][1]||"any");
			var property = this._group_prop_accessor(stats.map[prop][0]);
			if (typeof functor != "function"){
				smdui.assert(smdui.GroupMethods[functor], "unknown grouping rule: "+functor);
				functor = smdui.GroupMethods[functor];
			}

			for (var i=0; i < labels.length; i++) {
				labels[i][prop]=functor.call(this, property, groups[labels[i].id]);
			}
		}
			
		this._not_grouped_order = this.order;
		this._not_grouped_pull = this.pull;
		
		this.order = smdui.toArray();
		this.pull = {};
		for (var i=0; i < labels.length; i++){
			var id = this.id(labels[i]);
			this.pull[id] = labels[i];
			this.order.push(id);
			if (this._scheme_init)
				this._scheme_init(labels[i]);
		}
		
		this.callEvent("onStoreUpdated",[]);
	},
	_group_tree:function(input, parent){
		this._group_level_count = (this._group_level_count||0) + 1;

		//supports simplified group by syntax
		var stats;
		if (typeof input == "string"){
			stats = { by:this._group_prop_accessor(input), map:{} };
			stats.map[input] = [input];
		} else if (typeof input == "function"){
			stats = { by:input, map:{} };
		} else
			stats = input;
		
		//prepare
		var level;
		if (parent)
			level = this.getItem(parent).$level;
		else {
			parent  = 0;
			level = 0;
		}
		
		var order = this.branch[parent];
		var key = this._group_prop_accessor(stats.by);
		
		//run
		var topbranch = [];
		var labels = [];
		for (var i=0; i<order.length; i++){
			var data = this.getItem(order[i]);
			var current = key(data);
			var current_id = level+"$"+current;
			var ancestor = this.branch[current_id];

			if (!ancestor){
				var newitem = this.pull[current_id] = { id:current_id, value:current, $group:true, $row:stats.row};
				if (this._scheme_init)
					this._scheme_init(newitem);
				labels.push(newitem);
				ancestor = this.branch[current_id] = [];
				ancestor._formath = [];
				topbranch.push(current_id);
			}
			ancestor.push(data.id);
			ancestor._formath.push(data);
		}

		this.branch[parent] = topbranch;
		for (var prop in stats.map){
			var functor = (stats.map[prop][1]||"any");
			var property = this._group_prop_accessor(stats.map[prop][0]);
			if (typeof functor != "function"){
				smdui.assert(smdui.GroupMethods[functor], "unknown grouping rule: "+functor);
				functor = smdui.GroupMethods[functor];
			}
				
			for (var i=0; i < labels.length; i++)
				labels[i][prop]=functor.call(this, property, this.branch[labels[i].id]._formath);
		}

		for (var i=0; i < labels.length; i++){
			var group = labels[i];

			if (this.hasEvent("onGroupCreated"))
				this.callEvent("onGroupCreated", [group.id, group.value, this.branch[group.id]._formath]);

			if (stats.footer){
				var id = "footer$"+group.id;
				var footer = this.pull[id] = { id:id, $footer:true, value: group.value, $level:level, $count:0, $parent:group.id, $row:stats.footer.row};
				for (var prop in stats.footer){
					var functor = (stats.footer[prop][1]||"any");
					var property = this._group_prop_accessor(stats.footer[prop][0]);
					if (typeof functor != "function"){
						smdui.assert(smdui.GroupMethods[functor], "unknown grouping rule: "+functor);
						functor = smdui.GroupMethods[functor];
					}

					footer[prop]=functor.call(this, property, this.branch[labels[i].id]._formath);
				}
				
				this.branch[group.id].push(footer.id);
				this.callEvent("onGroupFooter", [footer.id, footer.value, this.branch[group.id]._formath]);
			}

			delete this.branch[group.id]._formath;
		}
			

		this._fix_group_levels(topbranch, parent, level+1);
			
		this.callEvent("onStoreUpdated",[]);
	},
	_ungroup_tree:function(skipRender, parent, force){
		//not grouped
		if (!force && !this._group_level_count) return;
		this._group_level_count = Math.max(0, this._group_level_count -1 );

		parent = parent || 0;
		var order = [];
		var toporder = this.branch[parent];
		for (var i=0; i<toporder.length; i++){
			var id = toporder[i];
			var branch = this.branch[id];
			if (branch)
				order = order.concat(branch);

			delete this.pull[id];
			delete this.branch[id];
		}

		this.branch[parent] = order;
		for (var i = order.length - 1; i >= 0; i--) {
			if (this.pull[order[i]].$footer)
				order.splice(i,1);
		}
		this._fix_group_levels(order, 0, 1);

		if (!skipRender)
			this.callEvent("onStoreUpdated",[]);
	},
	_fix_group_levels:function(branch, parent, level){
		if (parent)
			this.getItem(parent).$count = branch.length;

		for (var i = 0; i < branch.length; i++) {
			var item = this.pull[branch[i]];
			item.$level = level;
			item.$parent = parent;
			var next = this.branch[item.id];
			if (next)
				this._fix_group_levels(next, item.id, level+1);
		}
	}
};
smdui.clipbuffer = {

	_area: null,
	_blur_id: null,
	_ctrl: 0,

	/*! create textarea or returns existing
	 **/
	init: function() {
		// returns existing textarea
		if (this._area !== null)
			return this._area;

		smdui.destructors.push({ obj: this });
		// creates new textarea
		this._area = document.createElement('textarea');
		this._area.className = "smdui_clipbuffer";
		this._area.setAttribute("smduiignore", 1);
		document.body.appendChild(this._area);

		smdui.event(document.body, 'keydown', smdui.bind(function(e){
			var key = e.keyCode;
			var ctrl = !!(e.ctrlKey || e.metaKey);
			if (key === 86 && ctrl)
				smdui.delay(this._paste, this, [e], 100);
		}, this));

		return this._area;
	},
	destructor: function(){
		this._area = null;
	},
	/*! set text into buffer
	 **/
	set: function(text) {
		this.init();
		this._area.value = text;
		this.focus();
	},
	/*! select text in textarea
	 **/
	focus: function() {
		// if there is native browser selection, skip focus
		if(!this._isSelectRange()){
			this.init();
			this._area.focus();
			this._area.select();
		}

	},
	/*! checks document selection
	 **/
	_isSelectRange: function() {
		var text = "";
		if (typeof window.getSelection != "undefined") {
			text = window.getSelection().toString();
		} else if (typeof document.selection != "undefined" && document.selection.type == "Text") {
			text = document.selection.createRange().text;
		}
		return !!text;
	},
	/*! process ctrl+V pressing
	 **/
	_paste: function(e) {
		var trg = e.target || e.srcElement;
		if (trg === this._area) {
			var text = this._area.value;
			var last_active = smdui.UIManager.getFocus();
			if (last_active && (!last_active.getEditor || !last_active.getEditor())){
				last_active.callEvent("onPaste", [text]);
				this._area.select();
			}
		}
	}
};


smdui.CopyPaste = {
	clipboard_setter: function(value) {
		if (value === true || value === 1) value = "modify";
		this.attachEvent("onAfterSelect", function(id) {
			if (!this.getEditor || !this.getEditor()){
				var item = this.getItem(id);
				var text = this.type.templateCopy(item);
				smdui.clipbuffer.set(text, this);
				smdui.clipbuffer.focus();
				smdui.UIManager.setFocus(this);
			}
		});
		this.attachEvent("onPaste", function(text) {
			if (!smdui.isUndefined(this._paste[this._settings.clipboard]))
				this._paste[this._settings.clipboard].call(this, text);
		});
		this.attachEvent("onFocus", function() {
			smdui.clipbuffer.focus();
		});
		// solution for clicks on selected items
		this.attachEvent("onItemClick",function(id){
			if(!this._selected || this._selected.find(id)!==-1){
				smdui.clipbuffer.focus();
				smdui.UIManager.setFocus(this);
			}
		});
		return value;
	},
	_paste: {
		// insert new item with pasted value
		insert: function(text) {
			this.add({ value: text });
		},
		// change value of each selected item
		modify: function(text) {
			var sel = this.getSelectedId(true);
			for (var i = 0; i < sel.length; i++) {
				this.getItem(sel[i]).value = text;
				this.refresh(sel[i]);
			}
		},
		// do nothing
		custom: function(text) {}
	},
	templateCopy_setter: function(value) {
		this.type.templateCopy = smdui.template(value);
	},
	type:{
		templateCopy: function(item) {
			return this.template(item);
		}
	}
};


smdui.KeysNavigation = {
    $init:function(){
        if(this.getSelectedId){
            this.attachEvent("onAfterRender", this._set_focusable_item);
            this.attachEvent("onAfterSelect", smdui.once(function(){
                if(this.count()>1){
                    var node =  this._dataobj.querySelector("["+this._id+"]");
                    if(node) node.setAttribute("tabindex", "-1");
                }
            }));
        }
    },
    _set_focusable_item:function(){
        var sel = this.getSelectedId(true);
        if(!sel.length || !this.getItemNode(sel[0])){
            var node =  this._dataobj.querySelector("["+this._id+"]");
            if(node) node.setAttribute("tabindex", "0");
        }
    },
    _navigation_helper:function(mode){
        return function(view, e){
            var tag = (e.srcElement || e.target);

            //ignore clipboard listener
            if (!tag.getAttribute("smduiignore")){
                //ignore hotkeys if focus in the common input
                //to allow normal text edit operations
                var name = tag.tagName;
                if (name == "INPUT" || name == "TEXTAREA" || name == "SELECT") return true;
            }

            if (view && view.moveSelection && view.config.navigation && !view._in_edit_mode){
                smdui.html.preventEvent(e);
                return view.moveSelection(mode, e.shiftKey);
            }
            return true;
        };
    },
    moveSelection:function(mode, shift){
        var config = this._settings;
        if(config.disabled) return;
        //get existing selection
        var selected = this.getSelectedId(true);
        var x_layout = (this.count && (config.layout =="x" || config.xCount > 1));


         if((mode == "right" || mode == "left") && this._parent_menu){
            var parent = smdui.$$(this._parent_menu);
          
            parent._hide_sub_menu(true);
            if(parent.config.layout === "x")
                parent.moveSelection(mode);
            else
                smdui.UIManager.setFocus(parent);
            return;
        }

        if (!selected.length && this.count()){
            if (mode == "down" || (mode == "right" && x_layout)) mode = "top";
            else if (mode == "up" || (mode == "left" && x_layout)) mode = "bottom";
            else return;
            selected = [this.getFirstId()];
        }

        if (selected.length == 1){  //if we have a selection
            selected = selected[0];
            var prev = selected;

            if (mode == "left" && this.close)
                return this.close(selected);
            if (mode == "right" && this.open)
                return this.open(selected);

            else if (mode == "top") {
                selected = this.getFirstId();
            } else if (mode == "bottom") {
                selected = this.getLastId();
            } else if (mode == "up" || mode == "left" || mode == "pgup") {
                var index = this.getIndexById(selected);
                var step = mode == "pgup" ? 10 : 1;
                selected = this.getIdByIndex(Math.max(0, index-step));
            } else if (mode == "down" || mode == "right" || mode == "pgdown") {
                var index = this.getIndexById(selected);
                var step = mode == "pgdown" ? 10 : 1;
                selected = this.getIdByIndex(Math.min(this.count()-1, index+step));
            } else {
                smdui.assert(false, "Not supported selection moving mode");
                return;
            }

            if(this._skip_item)
                selected = this._skip_item(selected, prev, mode);

            this.showItem(selected);
            this.select(selected);

            if(this.getSubMenu && this.getSubMenu(selected))
                this._mouse_move_activation(selected, this.getItemNode(selected));

            if(!this.config.clipboard){
                var node = this.getItemNode(selected);
                if(node) node.focus();
            }
        }
        return false;
    },
    navigation_setter:function(value){
        //using global flag to apply hotkey only once
        if (value && !smdui.UIManager._global_nav_grid_hotkeys){
            smdui.UIManager._global_nav_grid_hotkeys = true;
            //hotkeys will react on any component but will not work in edit mode
            //you can define moveSelection method to handle navigation keys
            smdui.UIManager.addHotKey("up",         this._navigation_helper("up"));
            smdui.UIManager.addHotKey("down",       this._navigation_helper("down"));
            smdui.UIManager.addHotKey("shift+up",   this._navigation_helper("up"));
            smdui.UIManager.addHotKey("shift+down", this._navigation_helper("down"));
            smdui.UIManager.addHotKey("shift+right",   this._navigation_helper("right"));
            smdui.UIManager.addHotKey("shift+left", this._navigation_helper("left"));
            smdui.UIManager.addHotKey("pageup", 	this._navigation_helper("pgup"));
            smdui.UIManager.addHotKey("pagedown",   this._navigation_helper("pgdown"));
            smdui.UIManager.addHotKey("home", 	    this._navigation_helper("top"));
            smdui.UIManager.addHotKey("end", 		this._navigation_helper("bottom"));
            smdui.UIManager.addHotKey("right", 	    this._navigation_helper("right"));
            smdui.UIManager.addHotKey("left",		this._navigation_helper("left"));

        }

        return value;
    }
};


/*
    UI: navigation control
*/
smdui.NavigationButtons = {
	$init:function(){
		this.$ready.push(function(){
			this.attachEvent("onKeyPress", this._onKeyPress);
		});
	},
	_moveActive:function(code, e){
		if(code === 37  || code === 39){
			smdui.html.preventEvent(e);
			this._showNavItem(code===37?-1:1);

			var node = this._navPanel.querySelector("[tabindex='0']");
			if(node) node.focus();
		}
	},
	_renderPanel:function(){
		smdui.html.remove(this._navPanel);


		this._navPanel = smdui.html.create("DIV",{
			"class":"smdui_nav_panel "+"smdui_nav_panel_"+this._settings.navigation.type,
			"role":"tablist"
		},"");

		this._viewobj.appendChild(this._navPanel);


		this._renderNavItems();
		this._renderNavButtons();
		this._setLinkEventHandler();
	},
	_setLinkEventHandler: function(){
		var h = [];
		if(this._navPanel)
			h[0] = smdui.event(this._navPanel,"click", smdui.bind(function(e){
				var elem = (e.srcElement || e.target);
				var found = false;
				while(elem != this._navPanel && !found){
					var bindId = elem.getAttribute(this._linkAttr);
					if(bindId){
						found = true;
						this._showPanelBind(bindId);
					}
					elem = elem.parentNode;
				}
			},this));
		if(this._prevNavButton)
			h[1] = smdui.event(this._prevNavButton,"click", smdui.bind(function(e){
				this._showNavItem(-1);
			},this));
		if(this._nextNavButton)
			h[1] = smdui.event(this._nextNavButton,"click", smdui.bind(function(e){
				this._showNavItem(1);
			},this));
		this.attachEvent("onDestruct", function(){
			for(var i=0;i< h.length; i++){
				this.detachEvent(h[i]);
			}
			h = null;
		});
	},
	_showNavItem: function(inc){
		if(this._cells){
			var index = this._active_cell + inc;
			if(index >= this._cells.length || index < 0){
				index = (index < 0?this._cells.length-1:0);
			}
			this.setActiveIndex(index);
		}
	},
	_showPanelBind: function(id){
		if(this._cells)
			smdui.$$(id).show();
	},
	_renderNavItems:function(){
		var item, config;
		config = this._settings.navigation;
		if(config.items){
			this._linkAttr = config.linkAttr || "bind_id";

			if(!this._navPanel)
				this._renderPanel();
			else
				this._clearPanel();

			var data = (this._cells?this._cells:this.data.order);
			if(data.length>1){
				for (var i=0; i < data.length; i++){

					item = smdui.html.create("DIV",{
						"class":"smdui_nav_item smdui_nav_"+(i==this._active_cell?"active":"inactive"),
						"role":"tab",
						"tabindex":(i==this._active_cell?"0":"-1")
					},"<div></div>");
					var id = this._cells?this._cells[i]._settings.id:data[i];
					if(id)
						item.setAttribute(this._linkAttr, id);
					this._navPanel.appendChild(item);
				}
			}
		}
	},
	_clearPanel:function(){
		if (this._navPanel){
			var coll = this._navPanel.childNodes;
			for (var i = coll.length - 1; i >= 0; i--)
				smdui.html.remove(coll[i]);
		}
	},
	_renderNavButtons: function(){
		var item, config;
		config = this._settings.navigation;
		if(config.buttons){

			if(this._prevNavButton)
				smdui.html.remove(this._prevNavButton);
			if(this._prevNavButton)
				smdui.html.remove(this._nextNavButton);


			this._prevNavButton = smdui.html.create(
				"DIV",
				{
					"class":"smdui_nav_button_"+config.type+" smdui_nav_button_prev ",
					"role":"button",
					"tabindex":"0",
					"aria-label":smdui.i18n.aria.prevTab
				},
				"<div class=\"smdui_nav_button_inner\"></div>"
			);
			this._viewobj.appendChild(this._prevNavButton);

			this._nextNavButton = smdui.html.create(
				"DIV",
				{
					"class":"smdui_nav_button_"+config.type+" smdui_nav_button_next ",
					"role":"button",
					"tabindex":"0",
					"aria-label":smdui.i18n.aria.nextTab
				},
				"<div class=\"smdui_nav_button_inner\"></div>"
			);
			this._viewobj.appendChild(this._nextNavButton);
		}
	}
};


(function(){

	smdui.env.printPPI = 96;
	smdui.env.printMargin = 0.75*smdui.env.printPPI;

	var ppi = smdui.env.printPPI;
	var margin = smdui.env.printMargin;
	var papers = { "a4":"A4", "a3":"A3", "letter":"letter"};
	var fits = { page:true, data:true};
	var modes = { portrait:true, landscape:true};

	var sizes = {//inches, real size is value*ppi
		"A3": { width: 11.7, height: 16.5 },
		"A4": { width: 8.27, height:11.7 },
		"letter": { width: 8.5, height:11 }
	};

	smdui.print = function(id, options){

        var view = smdui.$$(id);
		if (view && view.$printView)
			view = view.$printView();

		smdui.assert(view, "non-existing view for printing");
		if(!view) return;

		if(view.callEvent)
			view.callEvent("onBeforePrint", [options]);

		options = _checkOptions(options);
		_beforePrint(options);

		//try widget's custom logic first, sometimes it may deny 
		if(!view.$customPrint || view.$customPrint(options) === true) 
			_print(view, options);
 
		_afterPrint(options);
	};

	/*processing print options*/
	function _checkOptions(options){
		
		options = options || {};
        options.paper = papers[(options.paper || "").toLowerCase()] || "A4";
        options.mode = modes[options.mode] ? options.mode : "portrait";
        options.fit = fits[options.fit] ? options.fit: "page";
		options.scroll = options.scroll || false;
        options.size = sizes[options.paper];

		options.margin = (options.margin || options.margin === 0) ? options.margin : {};
        margin = isNaN(options.margin*1) ? margin : options.margin;
        options.margin = {
        	top:(options.margin.top || options.margin.top === 0) ? options.margin.top: margin, 
        	bottom:(options.margin.bottom || options.margin.bottom === 0) ? options.margin.bottom: margin, 
        	right:(options.margin.right || options.margin.right === 0) ? options.margin.right: margin, 
        	left:(options.margin.left || options.margin.left === 0) ? options.margin.left: margin
        };

        return options;
	}

	/*preparing printing environment*/
	function _beforePrint(options){
		smdui.html.addCss(document.body,"smdui_print");

		if(options.docHeader) _getHeaderFooter("Header", options);
		if(options.docFooter) _getHeaderFooter("Footer", options);

		/* static print styles are located at 'css/print.less'*/
		var cssString = "@media print { "+
			"@page{ size:"+options.paper+" "+options.mode+";"+
				"margin-top:"+options.margin.top+"px;margin-bottom:"+options.margin.bottom+
				"px;margin-right:"+options.margin.right+"px;margin-left:"+options.margin.left+
			"px;}"+
		"}";
		smdui.html.addStyle(cssString, "print");
	}

	/*cleaning environment*/
	function _afterPrint(options){
		smdui.html.removeCss(document.body, "smdui_print");
		smdui.html.removeStyle("print");

		if(options.docHeader) smdui.html.remove(options.docHeader);
		if(options.docFooter) smdui.html.remove(options.docFooter);
	}

	/*common print actions */
	function _print(view, options){
		var doc = view.$view.cloneNode(true);

		//copy data from all canvases
		var canvases = view.$view.getElementsByTagName("canvas");
		if(canvases.length)
			for(var i = canvases.length-1; i >=0; i--){
				var destCtx = doc.getElementsByTagName("canvas")[i].getContext('2d');
				destCtx.drawImage(canvases[i], 0, 0);
			}

		smdui.html.insertBefore(doc, options.docFooter, document.body);

		smdui.html.addCss(doc,"smdui_ui_print");
		if(!options.scroll && ((view._dataobj && view.data && view.data.pull) || view.getBody))
			smdui.html.addCss(doc, "smdui_print_noscroll");

		window.print();

		smdui.html.remove(doc);
	}
	/*custom header nad footer*/
	function _getHeaderFooter(group, options){
		var header =  smdui.html.create("div", { 
			"class":"smdui_view smdui_print_"+group.toLowerCase(),
			"style":"height:0px;visibility:hidden;"
		}, options["doc"+group]);

		if(group ==="Header")
			smdui.html.insertBefore(header, document.body.firstChild);
		else
			document.body.appendChild(header);

		options["doc"+group] = header;
	}

})();

smdui.CustomPrint = {
	$customPrint:function(options, htmlOnly){
		if(this._prePrint(options, htmlOnly))
			return true;

		var tableData = this._getTableArray(options);
		var table = this._getTableHTML(tableData, options);

		if(htmlOnly)
			return table;

		var doc = smdui.html.create("div", { "class":"smdui_ui_print"});
		doc.appendChild(table);

		smdui.html.insertBefore(doc, options.docFooter, document.body);
		window.print();
		
		smdui.html.remove(doc);
	},
	_prePrint:function(options, htmlOnly){
		if(!htmlOnly && (this.config.layout =="y" || options.scroll || this.config.prerender || this.config.autoheight)) return true;
		
		if(this.config.layout =="x")
			smdui.extend(options || {}, {xCount:this.count(), nobreaks:true}, true);
	},
	_getPageWidth:function(options){
		if(options.fit =="page") return Infinity;

		var size = options.size;
		var width = size[options.mode == "portrait"?"width":"height"];
		
		return Math.min(width*smdui.env.printPPI-2*smdui.env.printMargin);
	},
	_getTableArray:function(options, base, start){
		var maxWidth = this._getPageWidth(options);
		var xCount = options.xCount || this._getVisibleRange()._dx;

		var tableArray = [];
		var colrow = [];
		var width = 0;
		
		var newTableStart, rownum, colnum;

		start = start || 0;
		base = base || [];

		for(var i = 0; i<this.data.order.length;){
			var obj = this.data.pull[this.data.order[i]];
			rownum = parseInt(i/xCount);
			colnum = i-(rownum*xCount);

			if(obj && colnum>=start){
				width += this.type.width;
				
				//start a new table, if cells do not fit page width
				if(width > maxWidth && colnum>start){ // 'colnum>start' ensures that a single long cell will have to fit the page
					newTableStart = colrow.length+start;
					tableArray.push(colrow);
					i = i+(xCount-colrow.length);
					colrow = [];
					width = 0;
					continue;
				}

				var cellValue = this.type.template(obj, this.type);
				var className = this._itemClassName;
				
				var style  = {
					display:"table-cell",
					height:this.type.height + "px",
					width:this.type.width + "px"
				};
				//push a cell to a row
				colrow.push({
					txt: cellValue,
					className: className+" "+(obj.$css || ""),
					style: style
				});
				//push a row to a table and start a new row
				if((i+1)%xCount === 0){
					tableArray.push(colrow);
					colrow = [];
					width = 0;
				}
			}
			i++;
		}

		base.push(tableArray);

		if(newTableStart)
			this._getTableArray(options, base, newTableStart);	

		return base;
	},
	_getTableHTML:function(tableData, options){
		
		var container = smdui.html.create("div");

		tableData.forEach(smdui.bind(function(table, i){

			var tableHTML = smdui.html.create("table", {
				"class":"smdui_table_print "+this.$view.className,
				"style":"border-collapse:collapse"
			});

			table.forEach(function(row){
				var tr = smdui.html.create("tr");

				row.forEach(function(column){
					var td = smdui.html.create("td");


					if (column.txt) td.innerHTML = column.txt;
					if (column.className) td.className = column.className;
					if (column.style) {
						var keys = Object.keys(column.style);
						keys.forEach(function(key){
							if (column.style[key])
								td.style[key] = column.style[key];
						});
					}
					if(column.span){
						if(column.span.colspan > 1)
							td.colSpan = column.span.colspan;
						if(column.span.rowspan > 1)
							td.rowSpan = column.span.rowspan;
					}
					tr.appendChild(td);
				});
				tableHTML.appendChild(tr);
			});
			container.appendChild(tableHTML);

			if(!options.nobreaks && i+1 < tableData.length){
				var br = smdui.html.create("DIV", {"class":"smdui_print_pagebreak"});
				container.appendChild(br);
			}
			
		}, this));

		return container;
	}
};

smdui.protoUI({
	name:"list",
	_listClassName : "smdui_list",
	_itemClassName:"smdui_list_item",
	$init:function(config){
		smdui.html.addCss(this._viewobj, this._listClassName + (((config.layout||this.defaults.layout) == "x")?"-x":"") );
		this.data.provideApi(this,true);

		this._auto_resize = smdui.bind(this._auto_resize, this);
		this.data.attachEvent("onStoreUpdated", this._auto_resize);
		this.data.attachEvent("onSyncApply", this._auto_resize);
		this.attachEvent("onAfterRender", this._correct_width_scroll);

		this._viewobj.setAttribute("role", "listbox");
	},
	$dragHTML:function(obj, e){
		if (this._settings.layout == "y" && this.type.width == "auto"){
			this.type.width = this._content_width;
			var node = this._toHTML(obj);
			this.type.width = "auto";
			return node;
		}
		return this._toHTML(obj);
	},
	defaults:{
		select:false,
		scroll:true,
		layout:"y",
		navigation:true
	},
	_id:"smdui_l_id",
	on_click:{
		smdui_list_item:function(e,id){
			if (this._settings.select){
                this._no_animation = true;
				if (this._settings.select=="multiselect"  || this._settings.multiselect)
					this.select(id, false, (e.ctrlKey || e.metaKey || (this._settings.multiselect == "touch")), e.shiftKey); 	//multiselection
				else
					this.select(id);
                this._no_animation = false;
			}
		}
	},
	on_dblclick:{
	},
	getVisibleCount:function(){
		return Math.floor(this._content_height / this._one_height());
	},
	_auto_resize:function(){
		if (this._settings.autoheight || this._settings.autowidth)
			this.resize();
	},
	_auto_height_calc:function(count){
		var value = this.data.$pagesize||this.count();

		this._onoff_scroll(count && count < value);
		if (this._settings.autoheight && value < (count||Infinity) ) 
			count = value;
		return Math.max(this._one_height() * count + (this.type.margin||0),this._settings.minHeight||0);
	},
	_one_height:function(){
		return this.type.height + (this.type.margin||0);
	},
	_auto_width_calc:function(count){
		var value = this.data.$pagesize||this.count();

		this._onoff_scroll(count && count < value);
		if (this._settings.autowidth && value < (count||Infinity) ) 
			count = value;

		return (this.type.width * count); 
	},
	_correct_width_scroll:function(){
		if (this._settings.layout == "x")
			this._dataobj.style.width = (this.type.width != "auto") ? (this.type.width * this.count() + "px") : "auto";
	},
	$getSize:function(dx,dy){
		if (this._settings.layout == "y"){
			if (this.type.width!="auto")
				this._settings.width = this.type.width + (this._scroll_y?smdui.ui.scrollSize:0);
			if (this._settings.yCount || this._settings.autoheight)
				this._settings.height = this._auto_height_calc(this._settings.yCount)||1;
		}
		else {
			if (this.type.height!="auto")
				this._settings.height = this._one_height() + (this._scroll_x?smdui.ui.scrollSize:0);
			if (this._settings.xCount || this._settings.autowidth)
				this._settings.width = this._auto_width_calc(this._settings.xCount)||1;
		}
		return smdui.ui.view.prototype.$getSize.call(this, dx, dy);
	},
	$setSize:function(){
        smdui.ui.view.prototype.$setSize.apply(this, arguments);
	},
	type:{
		css:"",
		widthSize:function(obj, common){
			return common.width+(common.width>-1?"px":"");
		},
		heightSize:function(obj, common){
			return common.height+(common.height>-1?"px":"");
		},
		classname:function(obj, common, marks){
			var css = "smdui_list_item";
			if (obj.$css){
				if (typeof obj.$css == "object")
					obj.$css = smdui.html.createCss(obj.$css);
				css += " "+obj.$css;
			}
			if (marks && marks.$css)
				css += " "+marks.$css;

			return css;
		},
		aria:function(obj, common, marks){
			return 'role="option"'+(marks && marks.smdui_selected?' aria-selected="true" tabindex="0"':' tabindex="-1"')+(obj.$count && obj.$template?'aria-expanded="true"':'');
		},
		template:function(obj){
			return (obj.icon?("<span class='smdui_icon fa-"+obj.icon+"'></span> "):"") + obj.value + (obj.badge?("<div class='smdui_badge'>"+obj.badge+"</div>"):"");
		},
		width:"auto",
		templateStart:smdui.template('<div smdui_l_id="#id#" class="{common.classname()}" style="width:{common.widthSize()}; height:{common.heightSize()}; overflow:hidden;" {common.aria()}>'),
		templateEnd:smdui.template("</div>")
	},
	$skin:function(){
		this.type.height = smdui.skin.$active.listItemHeight;
	}
}, smdui.CustomPrint, smdui.KeysNavigation, smdui.DataMove, smdui.DragItem, smdui.MouseEvents, smdui.SelectionModel, smdui.Scrollable, smdui.ui.proto, smdui.CopyPaste);

smdui.protoUI({
	name:"grouplist",
	defaults:{
		animate:{
		}
	},
	_listClassName : "smdui_grouplist",
	$init:function(){
		smdui.extend(this.data, smdui.TreeStore, true);
		//needed for getRange
		this.data.count = function(){ return this.order.length; };
		this.data.provideApi(this,true);
		this.data.attachEvent("onClearAll", smdui.bind(this._onClear, this));
		this._onClear();
	},
	_onClear:function(){
		this._nested_cursor = [];
		this._nested_chain = [];
	},
	$setSize:function(){
        if (smdui.ui.view.prototype.$setSize.apply(this, arguments)){
	        //critical for animations in group list
	        this._dataobj.style.width = this._content_width;
	    }
	},	
	on_click:{
		smdui_list_item:function(e,id){
			if (this._in_animation) {
                return false;
            }

			for (var i=0; i < this._nested_chain.length; i++){
				if (this._nested_chain[i] == id){ //one level up
					for (var j=i; j < this._nested_chain.length; j++) {
						this.data.getItem(this._nested_chain[j]).$template="";
					}
					if (!i){ //top level
						this._nested_cursor = this.data.branch[0];
						this._nested_chain = [];
					} else {
						this._nested_cursor= this.data.branch[this._nested_chain[i-1]];
						this._nested_chain.splice(i);
					}
                    this._is_level_down = false;
					return this.render();
				}
			}

			var obj = this.getItem(id);
			if (obj.$count){	//one level down
                this._is_level_down = true;
				this._nested_chain.push(id);
				obj.$template = "Back";
				this._nested_cursor = this.data.branch[obj.id];
				return this.render();
			} else {
				if (this._settings.select){
                    this._no_animation = true;
					if (this._settings.select=="multiselect" || this._settings.multiselect)
						this.select(id, false, ((this._settings.multiselect == "touch") || e.ctrlKey || e.metaKey), e.shiftKey); 	//multiselection
					else
						this.select(id);
                    this._no_animation = false;
				}		
			}
		}
	},
    getOpenState:function(){
        return {parents:this._nested_chain,branch:this._nested_cursor};
    },
	render:function(id,data,type,after){
		var i, lastChain;

		//start filtering processing=>
		this._nested_chain = smdui.copy(this._nested_chain);
		this._nested_cursor = smdui.copy(this._nested_cursor);

		if(this._nested_chain.length){
			for(i = 0;i<this._nested_chain.length;i++){
				if(!this.data.branch[this._nested_chain[i]]){
					this._nested_chain.splice(i,1);
					i--;
				}
			}
		}
		lastChain =  (this._nested_chain.length?this._nested_chain[this._nested_chain.length-1]:0);
		this._nested_cursor = smdui.copy(this.data.branch[lastChain]) ;

		if(!this._nested_cursor.length&&this._nested_chain.length){
			this._nested_cursor =  [lastChain];
			this._nested_chain.pop();
		}
		//<= end filtering processing

		if (this._in_animation) {
            return smdui.delay(this.render, this, arguments, 100);
        }        
        for (i=0; i < this._nested_cursor.length; i++)
        	this.data.getItem(this._nested_cursor[i]).$template = "";

		if (!this._nested_cursor.length)
            this._nested_cursor = this.data.branch[0];

		this.data.order = smdui.toArray([].concat(this._nested_chain).concat(this._nested_cursor));
			
        if (this.callEvent("onBeforeRender",[this.data])){
            if(this._no_animation || !this._dataobj.innerHTML || !(smdui.animate.isSupported() && this._settings.animate) || (this._prev_nested_chain_length == this._nested_chain.length)) { // if dataobj is empty or animation is not supported
				smdui.RenderStack.render.apply(this, arguments);
            }
            else {
                //getRange - returns all elements
                if (this.callEvent("onBeforeRender",[this.data])){

                    if(!this._back_scroll_states)
                        this._back_scroll_states = [];

					var next_div = this._dataobj.cloneNode(false);
					next_div.innerHTML = this.data.getRange().map(this._toHTML,this).join("");

					var aniset = smdui.extend({}, this._settings.animate);
					aniset.direction = (this._is_level_down)?'left':'right';

					/*scroll position restore*/
					var animArr = [smdui.clone(aniset),smdui.clone(aniset)];
					if(this._is_level_down){
						this._back_scroll_states.push(this.getScrollState());
						if(smdui.Touch&&smdui.Touch.$active){
							animArr[0].y = 0;
							animArr[1].y = - this.getScrollState().y;
						}
					}
					else{
						var getScrollState = this._back_scroll_states.pop();
						if(smdui.Touch&&smdui.Touch.$active){
							animArr[0].y = -getScrollState.y;
							animArr[1].y = - this.getScrollState().y;
						}
					}

					var line = smdui.animate.formLine(
						next_div,
						this._dataobj,
						aniset
					);

					/*keeping scroll position*/
					if(smdui.Touch&&smdui.Touch.$active)
						smdui.Touch._set_matrix(next_div, 0,this._is_level_down?0:animArr[0].y, "0ms");

					aniset.master = this;
					aniset.callback = function(){
						this._dataobj = next_div;

						/*scroll position restore*/
						if(!this._is_level_down){
							if(smdui.Touch&&smdui.Touch.$active){
								smdui.delay(function(){
									smdui.Touch._set_matrix(next_div, 0,animArr[0].y, "0ms");
								},this);
							} else if (getScrollState) 
								this.scrollTo(0,getScrollState.y);
						}
						else if(!(smdui.Touch&&smdui.Touch.$active)){
							this.scrollTo(0,0);
						}

						smdui.animate.breakLine(line);
						aniset.master = aniset.callback = null;
						this._htmlmap = null; //clear map, it will be filled at first getItemNode
						this._in_animation = false;
						this.callEvent("onAfterRender",[]);
					};
					
					this._in_animation = true;
					smdui.animate(line, animArr);
                }
            }
            this._prev_nested_chain_length = this._nested_chain.length;
        }
	},
	templateBack_setter:function(config){
		this.type.templateBack = smdui.template(config);
	},
	templateItem_setter:function(config){
		this.type.templateItem = smdui.template(config);
	},
	templateGroup_setter:function(config){
		this.type.templateGroup = smdui.template(config);
	},
	type:{
		template:function(obj, common){
			if (obj.$count)
				return common.templateGroup(obj, common);
			return common.templateItem(obj, common);
		},
		css:"group",
		classname:function(obj, common, marks){
			return "smdui_list_item smdui_"+(obj.$count?"group":"item")+(obj.$template?"_back":"")+((marks&&marks.smdui_selected)?" smdui_selected ":"")+ (obj.$css?obj.$css:"");
		},
		templateStart:smdui.template('<div smdui_l_id="#id#" class="{common.classname()}" style="width:{common.widthSize()}; height:{common.heightSize()};  overflow:hidden;" {common.aria()}>'),
		templateBack:smdui.template("#value#"),
		templateItem:smdui.template("#value#"),
		templateGroup:smdui.template("#value#"),
        templateEnd:function(obj, common){
            var html = '';
            if(obj.$count) html += "<div class='smdui_arrow_icon'></div>";
            html += "</div>";
            return html;
        }
	},
	showItem:function(id){
		var obj, parent;
		if(id){
			obj = this.getItem(id);
			parent = obj.$parent;
			
			if (obj.$count)
				parent = obj.id;
		}
		this._nested_cursor = this.data.branch[parent||0];
		this._nested_chain=[];
				
		//build _nested_chain
		while(parent){
			this.getItem(parent).$template = "Back";
			this._nested_chain.unshift(parent);
			parent = this.getItem(parent).$parent;
		} 
		
		//render
		this._no_animation = true;
		this.render();
		this._no_animation = false;
		
		//scroll if necessary
		smdui.RenderStack.showItem.call(this,id);
	}
}, smdui.Group, smdui.ui.list );
smdui.type(smdui.ui.grouplist,{});


smdui.protoUI({
	name:"unitlist",
	_id:"smdui_item_id",
	uniteBy_setter: smdui.template,
   	render:function(id,data,type,after){
		var config = this._settings;
		if (!this.isVisible(config.id))
			return;
		if (smdui.debug_render)
			smdui.log("Render: "+this.name+"@"+config.id);
		if(!config.uniteBy){
			if (smdui.debug_render){
				smdui.log("uniteBy is undefined");
			}
			return false;
		}
		if (id){
			var cont = this.getItemNode(id); //get html element of updated item
            if(cont&&type=="update"&&(this._settings.uniteBy.call(this,data)==this.getItem(id).$unitValue)){
                var t = this._htmlmap[id] = this._toHTMLObject(data);
				smdui.html.insertBefore(t, cont);
				smdui.html.remove(cont);
				return;
			}
		}
		//full reset
		if (this.callEvent("onBeforeRender",[this.data])){
			this.units = null;
			this._setUnits();
			if(this.units){
				this._dataobj.innerHTML = this._getUnitRange().map(this._toHTML, this).join("");
				this._htmlmap = null; 
			}
			this.callEvent("onAfterRender",[]);
		}
	},
	getUnits:function(){
		var result = [];
		if(this.units){
			for(var b in this.units){
				result.push(b);
			}
		}
		return result;	
	},
	getUnitList:function(id){
		return (this.units?this.units[id]:null);
	},
	_toHTML:function(obj){
		//check if related template exist
		var mark = this.data._marks[obj.id];
		smdui.assert((!obj.$template || this.type["template"+obj.$template]),"RenderStack :: Unknown template: "+obj.$template);
		this.callEvent("onItemRender",[obj]);
		if(obj.$unit){
			return this.type.templateStartHeader(obj,this.type)+this.type.templateHeader.call(this,obj.$unit)+this.type.templateEnd(obj, this.type);
		}
		return this.type.templateStart(obj,this.type,mark)+(obj.$template?this.type["template"+obj.$template]:this.type.template)(obj,this.type)+this.type.templateEnd(obj, this.type);
	},
	_getUnitRange:function(){
		var data,i,u,unit;
		data = [];
		var min = this.data.$min || 0;
		var max = this.data.$max || Infinity;
		var count = 0;

		for(u in this.units){
			data.push({$unit:u});
			unit = this.units[u];
			for(i=0;i < unit.length;i++){
				if (count == min) data = [{$unit:u}];
				data.push(this.getItem(unit[i]));
				if (count == max) return smdui.toArray(data);
				count++;
			}
		}

		return smdui.toArray(data);
	},
	_setUnits: function(){
		var list = this;
		this.units = {};
		this.data.each(function(obj){
			var result = list._settings.uniteBy.call(this,obj);
            obj.$unitValue = result;
            if(!list.units[result])
				list.units[result] = [];
			list.units[result].push(obj.id);
		});
	},
	type:{
		headerHeight: 20,
		templateHeader: function(value){
			return "<span class='smdui_unit_header_inner'>"+value+"</span>";
		},
		templateStart:function(obj,type,marks){
			if(obj.$unit)
				return type.templateStartHeader.apply(this,arguments);
			var className = "smdui_list_item smdui_list_"+(type.css)+"_item"+((marks&&marks.smdui_selected)?" smdui_selected":"")+(obj.$css?obj.$css:"");
			var style = "width:"+type.widthSize(obj,type,marks)+"; height:"+type.heightSize(obj,type,marks)+"; overflow:hidden;"+(type.layout&&type.layout=="x"?"float:left;":"");
			return '<div smdui_item_id="'+obj.id+'" class="'+className+'" style="'+style+'" '+type.aria(obj, type, marks)+'>';
		},
		templateStartHeader:function(obj,type,marks){
			var className = "smdui_unit_header smdui_unit_"+(type.css)+"_header"+(obj.$selected?"_selected":"");
			var style = "width:"+type.widthSize(obj,type,marks)+"; height:"+type.headerHeight+"px; overflow:hidden;";
			return '<div smdui_unit_id="'+obj.$unit+'" class="'+className+'" style="'+style+'">';
		}
	},
	$skin:function(){
		this.type.headerHeight = smdui.skin.$active.unitHeaderHeight||20;
	}
}, smdui.ui.list);

/*
	UI:DataView
*/


 	
/*
	Behavior:EditAbility - enables item operation for the items
	
	@export
		edit
		stopEdit
*/



smdui.EditAbility={
	defaults:{
		editaction:"click"
	},
	$init:function(config){
		this._editors = {};
		this._in_edit_mode = 0;
		this._edit_open_time = 0;
		this._contentobj.style.position = "relative";
		if (config)
			config.onDblClick = config.onDblClick || {};

		this.attachEvent("onAfterRender", this._refocus_inline_editor);

		//when we call smdui.extend the editable prop can be already set
		if (this._settings.editable)
			this._init_edit_events_once();

		smdui.extend(this,smdui.Undo);
	},
	_refocus_try:function(newnode){
		try{ //Chrome throws an error if selectionStart is not accessible
			if (typeof newnode.selectionStart == "number") {
				newnode.selectionStart = newnode.selectionEnd = newnode.value.length;
			} else if (typeof newnode.createTextRange != "undefined") {
				var range = newnode.createTextRange();
				range.collapse(false);
				range.select();
			}
		} catch(e){}
	},
	_refocus_inline_editor:function(){
		var editor = this.getEditor();
		if (editor && editor.$inline && !editor.getPopup){
			var newnode = this._locateInput(editor);
			if (newnode && newnode != editor.node){
				var text = editor.node.value;
				editor.node = newnode;
				newnode.value = text;
				newnode.focus();

				this._refocus_try(newnode);
			} else 
				this.editStop();
		}
	},
	editable_setter:function(value){
		if (value)
			this._init_edit_events_once();
		return value;
	},
	_init_edit_events_once:function(){
		//will close editor on any click outside
		smdui.attachEvent("onEditEnd", smdui.bind(function(){
			if (this._in_edit_mode)
				this.editStop();
		}, this));
		smdui.attachEvent("onClick", smdui.bind(function(e){
			//but ignore click which opens editor
			if (this._in_edit_mode && (new Date())-this._edit_open_time > 200){
				if (!this._last_editor || this._last_editor.popupType || !e || ( !this._last_editor.node || !this._last_editor.node.contains(e.target || e.srcElement)))
					this.editStop();
			}
		}, this));
		
		//property sheet has simple data object, without events
		if (this.data.attachEvent)
			this.data.attachEvent("onIdChange", smdui.bind(function(oldid, newid){
				this._changeEditorId(oldid, newid);
			}, this));

		//when clicking on row - will start editor
		this.attachEvent("onItemClick", function(id){
			if (this._settings.editable && this._settings.editaction == "click")
				this.edit(id);
		});
		this.attachEvent("onItemDblClick", function(id){
			if (this._settings.editable && this._settings.editaction == "dblclick")
				this.edit(id);
		});
		//each time when we clicking on input, reset timer to prevent self-closing
		this._reset_active_editor = smdui.bind(function(){
			this._edit_open_time = new Date();
		},this);

		this._init_edit_events_once = function(){};

		if (this._component_specific_edit_init)
			this._component_specific_edit_init();
	},
	_handle_live_edits:function(){
		smdui.delay(function(){
			var editor = this.getEditor();
			if (editor && editor.config.liveEdit){
				var state = { value:editor.getValue(), old: editor.value };
				if (state.value == state.old) return;

				editor.value = state.value;
				this._set_new_value(editor, state.value, false);
				this.callEvent("onLiveEdit", [state, editor]);
			}
		}, this);
	},
	_show_editor_form:function(id){
		var form = this._settings.form;
		if (typeof form != "string")
			this._settings.form = form = smdui.ui(form).config.id;

		var form = smdui.$$(form);
		var realform = form.setValues?form:form.getChildViews()[0];

		
		realform.setValues(this.getItem(id.row || id));
		form.config.master = this.config.id;
		form.show( this.getItemNode(id) );

		var first = realform.getChildViews()[0];
		if (first.focus)
			first.focus();
	},
	edit:function(id, preserve, show){
		if (!this.callEvent("onBeforeEditStart", [id])) return;
		if (this._settings.form)
			return this._show_editor_form(id);

		var editor = this._get_editor_type(id);
		if (editor){
			if (this.getEditor(id)) return;
			if (!preserve) this.editStop();

			//render html input
			smdui.assert(smdui.editors[editor], "Invalid editor type: "+editor);
			var type = smdui.extend({}, smdui.editors[editor]);
			
			var node = this._init_editor(id, type, show);
			if (type.config.liveEdit)
				this._live_edits_handler = this.attachEvent("onKeyPress", this._handle_live_edits);

			var area = type.getPopup?type.getPopup(node)._viewobj:node;

			if (area)
				smdui._event(area, "click", this._reset_active_editor);
			if (node)
				smdui._event(node, "change", this._on_editor_change, { bind:{ view:this, id:id }});
			if (show !== false)
				type.focus();

			if (this.$fixEditor)
				this.$fixEditor(type);

			//save time of creation to prevent instant closing from the same click
			this._edit_open_time = smdui.edit_open_time = new Date();

			smdui.UIManager.setFocus(this, true);
			this.callEvent("onAfterEditStart", [id]);
			return type;
		}
		return null;
	},
	getEditor:function(id){
		if (!id)
			return this._last_editor;

		return this._editors[id];
	},
	_changeEditorId:function(oldid, newid)	{
		var editor = this._editors[oldid];
		if (editor){
			this._editors[newid] = editor;
			editor.id = newid;
			delete this._editors[oldid];
		}
	},
	_on_editor_change:function(e){
		if (this.view.hasEvent("onEditorChange"))
			this.view.callEvent("onEditorChange", [this.id, this.view.getEditorValue(this.id) ]);
	},
	_get_edit_config:function(id){
		return this._settings;
	},
	_init_editor:function(id, type, show){
		var config = type.config = this._get_edit_config(id);
		var node = type.render();

		if (type.$inline)
			node = this._locateInput(id);
		type.node = node;

		var item = this.getItem(id);
		//value can be configured by editValue option
		var value = item[this._settings.editValue||"value"];
		//if property was not defined - use empty value
		if (smdui.isUndefined(value))
			value = "";

		type.setValue(value, item);
		type.value = value;

		this._addEditor(id, type);

		//show it over cell
		if (show !== false)
			this.showItem(id);
		if (!type.$inline)
			this._sizeToCell(id, node, true);

		if (type.afterRender)
			type.afterRender();

		return node;
	},
	_locate_cell:function(id){
		return this.getItemNode(id);
	},
	_locateInput:function(id){
		var cell = this._locate_cell(id);
		if (cell)
			cell = cell.getElementsByTagName("input")[0] || cell;

		return cell;
	},
	_get_editor_type:function(id){
		return this._settings.editor;
	},
	_addEditor:function(id, type){
		type.id = id;
		this._editors[id]= this._last_editor = type;
		this._in_edit_mode++;
	},
	_removeEditor:function(editor){
		if (this._last_editor == editor)
			this._last_editor = 0;
		
		if (editor.destroy)
			editor.destroy();

		delete editor.popup;
		delete editor.node;

		delete this._editors[editor.id];
		this._in_edit_mode--;
	},
	focusEditor:function(id){
		var editor = this.getEditor.apply(this, arguments);
		if (editor && editor.focus)
			editor.focus();
	},
	editCancel:function(){
		this.editStop(null, null, true);
	},
	_applyChanges: function(el){
		if (el){
			var ed = this.getEditor();
			if (ed && ed.getPopup && ed.getPopup() == el.getTopParentView()) return;
		}
		this.editStop();
	},
	editStop:function(id){
		if (this._edit_stop) return;
		this._edit_stop = 1;


		var cancel = arguments[2];
		var result = 1;
		if (!id){
			this._for_each_editor(function(editor){
				result = result * this._editStop(editor, cancel);
			});
		} else 
			result = this._editStop(this._editors[id], cancel);

		this._edit_stop = 0;
		return result;
	},
	_cellPosition:function(id){
		var html = this.getItemNode(id);
		return {
			left:html.offsetLeft, 
			top:html.offsetTop,
			height:html.offsetHeight,
			width:html.offsetWidth,
			parent:this._contentobj
		};
	},
	_sizeToCell:function(id, node, inline){
		//fake inputs
		if (!node.style) return;

		var pos = this._cellPosition(id);

		node.style.top = pos.top + "px";
		node.style.left = pos.left + "px";

		node.style.width = pos.width-1+"px";
		node.style.height = pos.height-1+"px";

		node.top = pos.top; //later will be used during y-scrolling

		if (inline) pos.parent.appendChild(node);
	},
	_for_each_editor:function(handler){
		for (var editor in this._editors)
			handler.call(this, this._editors[editor]);
	},
	_editStop:function(editor, ignore){
		if (!editor) return;
		var state = { 
			value : editor.getValue(), 
			old : editor.value
		};
		if (this.callEvent("onBeforeEditStop", [state, editor, ignore])){
			if (!ignore){
				//special case, state.old = 0, state.value = ""
				//we need to state.old to string, to detect the change
				var old = state.old;
				if (typeof state.value == "string") old += "";

				if (old != state.value || editor.config.liveEdit){
					var item = this._set_new_value(editor, state.value, true);
					this.updateItem(editor.row || editor.id, item);
				}
			}
			if (editor.$inline)
				editor.node = null;
			else
				smdui.html.remove(editor.node);

			var popup = editor.config.suggest;
			if (popup && typeof popup == "string")
				smdui.$$(popup).hide();

			this._removeEditor(editor);
			if (this._live_edits_handler)
				this.detachEvent(this._live_edits_handler);

			this.callEvent("onAfterEditStop", [state, editor, ignore]);
			return 1;
		}
		return 0;
	},
	validateEditor:function(id){
		var result = true;
		if (this._settings.rules){
			var editor = this.getEditor(id);
			var key = editor.column||this._settings.editValue||"value";
			var rule = this._settings.rules[key];
			var all = this._settings.rules.$all;

			if (rule || all){
				var obj = this.data.getItem(editor.row||editor.id);
				var value = editor.getValue();
				var input = editor.getInputNode();

				if (rule)
					result = rule.call(this, value, obj, key);
				if (all)
					result = all.call(this, value, obj, key) && result;
			
				if (result)
					smdui.html.removeCss(input, "smdui_invalid");
				else
					smdui.html.addCss(input, "smdui_invalid");

				smdui.callEvent("onLiveValidation", [editor, result, obj, value]);
			}
		}
		return result;
	},
	getEditorValue:function(id){
		var editor;
		if (arguments.length === 0)
			editor = this._last_editor;
		else
			editor = this.getEditor(id);

		if (editor)
			return editor.getValue();
	},
	getEditState:function(){
		return this._last_editor || false;
	},
	editNext:function(next, from){ 
		next = next !== false; //true by default
		if (this._in_edit_mode == 1 || from){
			//only if one editor is active
			var editor_next = this._find_cell_next((this._last_editor || from), function(id){
				if (this._get_editor_type(id))
					return true;
				return false;
			}, next);

			if (this.editStop()){	//if we was able to close previous editor
				if (editor_next){	//and there is a new target
					this.edit(editor_next);	//init new editor
					this._after_edit_next(editor_next);
				}
				return false;
			}
		}
	},
	//stab, used in datatable
	_after_edit_next:function(){},
	_find_cell_next:function(start, check, direction){
		var row = this.getIndexById(start.id);
		var order = this.data.order;
		
		if (direction){
			for (var i=row+1; i<order.length; i++){
				if (check.call(this, order[i]))
					return order[i];
			}
		} else {
			for (var i=row-1; i>=0; i--){
				if (check.call(this, order[i]))
					return order[i];
			}
		}

		return null;
	},
	_set_new_value:function(editor, new_value, copy){
		var item = copy ? {} : this.getItem(editor.id);
		item[this._settings.editValue||"value"] = new_value;
		return item;
	}
};


(function(){

function init_suggest(editor, input){
	var suggest = editor.config.suggest;
	if (suggest){
		var box = editor.config.suggest = create_suggest(suggest);
		var boxobj = smdui.$$(box);
		if (boxobj && input)
			boxobj.linkInput(input);
	}
}

function create_suggest(config){
	if (typeof config == "string") return config;
	if (config.linkInput) return config._settings.id;

	
	if (typeof config == "object"){
		if (smdui.isArray(config))
			config = { data: config };
		config.view = config.view || "suggest";
	} else if (config === true)
		config = { view:"suggest" };

	var obj = smdui.ui(config);
	return obj.config.id;
}

function getLabel(config){
	var text = config.header && config.header[0]?config.header[0].text:config.editValue || config.label;
	return (text || "").toString().replace(/<[^>]*>/g, "");
}

/*
	this.node - html node, available after render call
	this.config - editor config
	this.value - original value
	this.popup - id of popup 
*/
smdui.editors = {
	"text":{
		focus:function(){
			this.getInputNode(this.node).focus();
			this.getInputNode(this.node).select();
		},
		getValue:function(){
			return this.getInputNode(this.node).value;
		},
		setValue:function(value){
			var input = this.getInputNode(this.node);
			input.value = value;

			init_suggest(this, input);
		},
		getInputNode:function(){
			return this.node.firstChild;
		},
		render:function(){
			return smdui.html.create("div", {
				"class":"smdui_dt_editor"
			}, "<input type='text' aria-label='"+getLabel(this.config)+"'>");
		}
	},
	"inline-checkbox":{
		render:function(){ return {}; },
		getValue:function(){
			return this.node.checked;
		},
		setValue:function(){},
		focus:function(){
			this.node.focus();
		},
		getInputNode:function(){},
		$inline:true
	},
	"inline-text":{
		render:function(){ return {}; },
		getValue:function(){
			return this.node.value;
		},
		setValue:function(){},
		focus:function(){
			try{	//IE9
				this.node.select();
				this.node.focus();
			} catch(e){}
		},
		getInputNode:function(){},
		$inline:true
	},
	"checkbox":{
		focus:function(){
			this.getInputNode().focus();
		},
		getValue:function(){
			return this.getInputNode().checked;
		},
		setValue:function(value){
			this.getInputNode().checked = !!value;
		},
		getInputNode:function(){
			return this.node.firstChild.firstChild;
		},
		render:function(){
			return smdui.html.create("div", {
				"class":"smdui_dt_editor"
			}, "<div><input type='checkbox' aria-label='"+getLabel(this.config)+"'></div>");
		}
	},
	"select":{
		focus:function(){
			this.getInputNode().focus();
		},
		getValue:function(){
			return this.getInputNode().value;
		},
		setValue:function(value){
			this.getInputNode().value = value;
		},
		getInputNode:function(){
			return this.node.firstChild;
		},
		render:function(){
			var html = "";
			var options = this.config.options || this.config.collection;
            smdui.assert(options, "options not defined for select editor");
            if (options.data && options.data.each) {
                options.data.each(function (obj) {
                    html += "<option value='" + obj.id + "'>" + obj.value + "</option>";
                });
            }
            else {
                if (smdui.isArray(options)) {
                    for (var i = 0; i < options.length; i++) {
                        var rec = options[i];
                        var isplain = smdui.isUndefined(rec.id);
                        var id = isplain ? rec : rec.id;
                        var label = isplain ? rec : rec.value;

                        html += "<option value='" + id + "'>" + label + "</option>";
                    }
                } else for (var key in options) {
                    html += "<option value='" + key + "'>" + options[key] + "</option>";
                }
            }

			return smdui.html.create("div", {
				"class":"smdui_dt_editor"
			}, "<select aria-label='"+getLabel(this.config)+"'>"+html+"</select>");
		}
	},
	popup:{
		focus:function(){
			this.getInputNode().focus();
		},
		destroy:function(){
			this.getPopup().hide();
		},
		getValue:function(){
			return this.getInputNode().getValue()||"";
		},
		setValue:function(value){
			this.getPopup().show(this.node);
			this.getInputNode().setValue(value);
		},
		getInputNode:function(){
			return this.getPopup().getChildViews()[0];
		},
		getPopup:function(){
			if (!this.config.popup)
				this.config.popup = this.createPopup();

			return smdui.$$(this.config.popup);
		},
		createPopup:function(){
			var popup = this.config.popup || this.config.suggest;

			if (popup){
				var pobj;
				if (typeof popup == "object" && !popup.name){
					popup.view = popup.view || "suggest";
					pobj = smdui.ui(popup);
				} else
					pobj = smdui.$$(popup);

				if (pobj.linkInput)
					pobj.linkInput(document.body);
				else if(this.linkInput)
					this.linkInput(document.body);

				return pobj;
			}

			var type = smdui.editors.$popup[this.popupType];
			if (typeof type != "string"){
				type = smdui.editors.$popup[this.popupType] = smdui.ui(type);
				this.popupInit(type);

				if(!type.linkInput)
					this.linkInput(document.body);
				
			}
			return type._settings.id;
		},
		linkInput:function(node){
			smdui._event(smdui.toNode(node), "keydown", smdui.bind(function(e){
				var code = e.which || e.keyCode, list = this.getInputNode();
				if(!list.isVisible()) return;

				if(code === 40){
					if(list.moveSelection)
						list.moveSelection("down");
					smdui.UIManager.setFocus(list);
				} 
				// shift+enter support for 'popup' editor
				else if(code === 13 && ( e.target.nodeName !=="TEXTAREA" || !e.shiftKey))
					smdui.callEvent("onEditEnd", []);
				
			}, this));
		},

		popupInit:function(popup){},
		popupType:"text",
		render	:function(){ return {}; },
		$inline:true
	}
};

smdui.editors.color = smdui.extend({
	focus	:function(){},
	popupType:"color",
	popupInit:function(popup){
		popup.getChildViews()[0].attachEvent("onSelect", function(value){
			smdui.callEvent("onEditEnd",[value]);
		});
	}
}, smdui.editors.popup);

smdui.editors.date = smdui.extend({
	focus	:function(){},
	popupType:"date",
	setValue:function(value){
		this._is_string = this.config.stringResult || (value && typeof value == "string");
		smdui.editors.popup.setValue.call(this, value);
	},
	getValue:function(){
		return this.getInputNode().getValue(this._is_string?smdui.i18n.parseFormatStr:"")||"";
	},
	popupInit:function(popup){
		popup.getChildViews()[0].attachEvent("onDateSelect", function(value){
			smdui.callEvent("onEditEnd",[value]);
		});
	}
}, smdui.editors.popup);

smdui.editors.combo = smdui.extend({
	_create_suggest:function(config){
        if(this.config.popup){
            return this.config.popup.config.id;
        }
		else if (config){
			return create_suggest(config);
		} else
			return this._shared_suggest(config);
	},
	_shared_suggest:function(){
		var e = smdui.editors.combo;
		return (e._suggest = e._suggest || this._create_suggest(true));
	},
	render:function(){
		var node = smdui.html.create("div", {
			"class":"smdui_dt_editor"
		}, "<input type='text' role='combobox' aria-label='"+getLabel(this.config)+"'>");

		//save suggest id for future reference		
		var suggest = this.config.suggest = this._create_suggest(this.config.suggest);

		if (suggest){
			smdui.$$(suggest).linkInput(node.firstChild, true);
			smdui._event(node.firstChild, "click",smdui.bind(this.showPopup, this));
		}
		return node;
	},
	getPopup:function(){
		return smdui.$$(this.config.suggest);
	},
	showPopup:function(){
		var popup = this.getPopup();
        var list = popup.getList();
		var input = this.getInputNode();
        var value = this.getValue();

		popup.show(input);
		input.setAttribute("aria-expanded", "true");
        if(value ){
           smdui.assert(list.exists(value), "Option with ID "+value+" doesn't exist");
            if(list.exists(value)){
                list.select(value);
                list.showItem(value);
            }
        }else{
            list.unselect();
            list.showItem(list.getFirstId());
        }
		popup._last_input_target = input;
	},
	afterRender:function(){
		this.showPopup();
	},
	setValue:function(value){
		this._initial_value = value;
		if (this.config.suggest){
			var sobj = smdui.$$(this.config.suggest);
			var data =  this.config.collection || this.config.options;
			if (data)
				sobj.getList().data.importData(data);

			this._initial_text = this.getInputNode(this.node).value = sobj.getItemText(value);
		}
	},
	getValue:function(){
		var value = this.getInputNode().value;
		
		if (this.config.suggest){
			if (value == this._initial_text)
				return this._initial_value;
			return smdui.$$(this.config.suggest).getSuggestion();
		} else 
			return value;
	}
}, smdui.editors.text);

smdui.editors.richselect = smdui.extend({
	focus:function(){},
	getValue:function(){
		return this.getPopup().getValue();
	},
	setValue:function(value){
		var suggest =  this.config.collection || this.config.options;
        var list = this.getInputNode();
		if (suggest)
			this.getPopup().getList().data.importData(suggest);

        this.getPopup().show(this.node);
        this.getPopup().setValue(value);
	},
	getInputNode:function(){
		return this.getPopup().getList();
	},
	popupInit:function(popup){
		popup.linkInput(document.body);
	},
	popupType:"richselect"
}, smdui.editors.popup);

smdui.editors.password = smdui.extend({
	render:function(){
		return smdui.html.create("div", {
			"class":"smdui_dt_editor"
		}, "<input type='password' aria-label='"+getLabel(this.config)+"'>");
	}
}, smdui.editors.text);

 //建斌20180527添加
smdui.editors.search = smdui.extend({
    render: function () {
        return smdui.html.create("div", {
            "class": "smdui_dt_editor"
        }, "<input type='text' aria-label='" + getLabel(this.config) + "'><span style='position:absolute;right:0;bottom:0' class='smdui_input_icon fa-search'></span>");
    }
}, smdui.editors.text);

//建斌20170923添加
 smdui.editors.popuptext = smdui.extend({
    afterRender: function () {
        this.showPopup();
    },
    getPopup: function () {
        return smdui.$$(this.config.popup);
    },
    showPopup: function () {
        var popup = this.getPopup();
        var input = this.getInputNode();
        popup.show(input);
        popup._last_input_target = input;
    },
    render: function () {
        var node = smdui.html.create("div", {
            "class": "smdui_dt_editor"
        }, "<input type='text'>");
        if (!this.config.editable) {
            node.firstChild.setAttribute("readonly", "readonly"); //默认单元格不可编辑
        }

        //save suggest id for future reference		
        var suggest = this.config.popup;

        if (suggest) {
            //webix.$$(suggest).linkInput(node.firstChild, true);
            smdui.event(node.firstChild, "click", smdui.bind(this.showPopup, this));
        }
        return node;
    }
}, smdui.editors.text); 

smdui.editors.$popup = {
	text:{
		view:"popup", width:250, height:150,
		body:{ view:"textarea" }
	},
	color:{
		view:"popup",
		body:{ view:"colorboard" }
	},
	date:{
		view:"popup", width:250, height:250, padding:0,
		body:{ view:"calendar", icons:true, borderless:true }
	},
	richselect:{
		view:"suggest",
		body:{ view:"list", select:true }
	}
};

})();
 

/*
	Renders collection of items
	Always shows y-scroll
	Can be used with huge datasets
	
	@export
		show
		render
*/
smdui.VirtualRenderStack={
	$init:function(){
		smdui.assert(this.render,"VirtualRenderStack :: Object must use RenderStack first");
		
		this._htmlmap={}; //init map of rendered elements
        
        //we need to repaint area each time when view resized or scrolling state is changed
        smdui._event(this._viewobj,"scroll",smdui.bind(this._render_visible_rows,this));
		if(smdui.env.touch){
			this.attachEvent("onAfterScroll", smdui.bind(this._render_visible_rows,this));
		}
		//here we store IDs of elemenst which doesn't loadede yet, but need to be rendered
		this._unrendered_area=[];
	},
	//return html object by item's ID. Can return null for not-rendering element
	getItemNode:function(search_id){
		//collection was filled in _render_visible_rows
		return this._htmlmap[search_id];
	},
	//adjust scrolls to make item visible
	showItem:function(id){
		var range = this._getVisibleRange();
		var ind = this.data.getIndexById(id);
		//we can't use DOM method for not-rendered-yet items, so fallback to pure math
		var dy = Math.floor(ind/range._dx)*range._y;
		var state = this.getScrollState();
		if (dy<state.y || dy + this._settings.height >= state.y + this._content_height)
			this.scrollTo(0, dy);
	},	
	//repain self after changes in DOM
	//for add, delete, move operations - render is delayed, to minify performance impact
	render:function(id,data,type){
		if (!this.isVisible(this._settings.id) || this.$blockRender)
			return;
		
		if (smdui.debug_render)
			smdui.log("Render: "+this.name+"@"+this._settings.id);
			
		if (id){
			var cont = this.getItemNode(id);	//old html element
			switch(type){
				case "update":
					if (!cont) return;
					//replace old with new
					var t = this._htmlmap[id] = this._toHTMLObject(data);
					smdui.html.insertBefore(t, cont); 
					smdui.html.remove(cont);
					break;
				default: // "move", "add", "delete"
					/*
						for all above operations, full repainting is necessary
						but from practical point of view, we need only one repainting per thread
						code below initiates double-thread-rendering trick
					*/
					this._render_delayed();
					break;
			}
		} else {
			//full repainting
			if (this.callEvent("onBeforeRender",[this.data])){
				this._htmlmap = {}; 					//nulify links to already rendered elements
				this._render_visible_rows(null, true);	
				// clear delayed-rendering, because we already have repaint view
				this._wait_for_render = false;			
				this.callEvent("onAfterRender",[]);
			}
		}
	},
	//implement double-thread-rendering pattern
	_render_delayed:function(){
		//this flag can be reset from outside, to prevent actual rendering 
		if (this._wait_for_render) return;
		this._wait_for_render = true;	
		
		window.setTimeout(smdui.bind(function(){
			this.render();
		},this),1);
	},
	//create empty placeholders, which will take space before rendering
	_create_placeholder:function(height){
		if(smdui.env.maxHTMLElementSize)
			height = Math.min(smdui.env.maxHTMLElementSize, height);
		var node = document.createElement("DIV");
			node.style.cssText = "height:"+height+"px; width:100%; overflow:hidden;";
		return node;
	},
	/*
		Methods get coordinatest of visible area and checks that all related items are rendered
		If, during rendering, some not-loaded items was detected - extra data loading is initiated.
		reset - flag, which forces clearing of previously rendered elements
	*/
	_render_visible_rows:function(e,reset){
		this._unrendered_area=[]; //clear results of previous calls
		
		var viewport = this._getVisibleRange();	//details of visible view

		if (!this._dataobj.firstChild || reset){	//create initial placeholder - for all view space
			this._dataobj.innerHTML="";
			this._dataobj.appendChild(this._create_placeholder(viewport._max));
			//register placeholder in collection
			this._htmlrows = [this._dataobj.firstChild];
		}
		
		/*
			virtual rendering breaks all view on rows, because we know widht of item
			we can calculate how much items can be placed on single row, and knowledge 
			of that, allows to calculate count of such rows
			
			each time after scrolling, code iterate through visible rows and render items 
			in them, if they are not rendered yet
			
			both rendered rows and placeholders are registered in _htmlrows collection
		*/

		//position of first visible row
		var t = viewport._from;
			
		while(t<=viewport._height){	//loop for all visible rows
			//skip already rendered rows
			while(this._htmlrows[t] && this._htmlrows[t]._filled && t<=viewport._height){
				t++; 
			}
			//go out if all is rendered
			if (t>viewport._height) break;
			
			//locate nearest placeholder
			var holder = t;
			while (!this._htmlrows[holder]) holder--;
			var holder_row = this._htmlrows[holder];
			
			//render elements in the row			
			var base = t*viewport._dx+(this.data.$min||0);	//index of rendered item
			if (base > (this.data.$max||Infinity)) break;	//check that row is in virtual bounds, defined by paging
			var nextpoint =  Math.min(base+viewport._dx-1,(this.data.$max?this.data.$max-1:Infinity));
			var node = this._create_placeholder(viewport._y);
			//all items in rendered row
			var range = this.data.getIndexRange(base, nextpoint);
			if (!range.length) break; 
			
			var loading = { $template:"Loading" };
			for (var i=0; i<range.length; i++){
				if (!range[i])
	        		this._unrendered_area.push(base+i);
				range[i] = this._toHTML(range[i]||loading);
			}

			node.innerHTML=range.join(""); 	//actual rendering
			for (var i=0; i < range.length; i++)					//register all new elements for later usage in getItemNode
				this._htmlmap[this.data.getIdByIndex(base+i)]=node.childNodes[i];
			
			//correct placeholders
			var h = parseFloat(holder_row.style.height,10);
			var delta = (t-holder)*viewport._y;
			var delta2 = (h-delta-viewport._y);
			
			//add new row to the DOOM
			smdui.html.insertBefore(node,delta?holder_row.nextSibling:holder_row,this._dataobj);
			this._htmlrows[t]=node;
			node._filled = true;
			
			/*
				if new row is at start of placeholder - decrease placeholder's height
				else if new row takes whole placeholder - remove placeholder from DOM
				else 
					we are inserting row in the middle of existing placeholder
					decrease height of existing one, and add one more, 
					before the newly added row
			*/
			if (delta <= 0 && delta2>0){
				holder_row.style.height = delta2+"px";
				this._htmlrows[t+1] = holder_row;
			} else {
				if (delta<0)
					smdui.html.remove(holder_row);
				else
					holder_row.style.height = delta+"px";
				if (delta2>0){ 
					var new_space = this._htmlrows[t+1] = this._create_placeholder(delta2);
					smdui.html.insertBefore(new_space,node.nextSibling,this._dataobj);
				}
			}
			
			
			t++;
		}
		
		//when all done, check for non-loaded items
		if (this._unrendered_area.length){
			//we have some data to load
			//detect borders
			var from = this._unrendered_area[0];
			var to = this._unrendered_area.pop()+1;
			if (to>from){
				//initiate data loading
				var count = to - from;
				if (this._maybe_loading_already(count, from)) return;

				count = Math.max(count, (this._settings.datafetch||this._settings.loadahead||0));
				this.loadNext(count, from);
			}
		}
	},
	//calculates visible view
	_getVisibleRange:function(){
		var state = this.getScrollState();
		var top = state.y;
		var width = this._content_width; 
		var height = this._content_height;

		//size of single item
		var t = this.type;

		var dx = Math.floor(width/t.width)||1; //at least single item per row
		
		var min = Math.floor(top/t.height);				//index of first visible row
		var dy = Math.ceil((height+top)/t.height)-1;		//index of last visible row
		//total count of items, paging can affect this math
		var count = this.data.$max?(this.data.$max-this.data.$min):this.data.count();
		var max = Math.ceil(count/dx)*t.height;			//size of view in rows

		return { _from:min, _height:dy, _top:top, _max:max, _y:t.height, _dx:dx};
	},
	_cellPosition:function(id){
		var html = this.getItemNode(id);
		if (!html){
			this.showItem(id);
			this._render_visible_rows();
			html = this.getItemNode(id);
		}
		return {
			left:html.offsetLeft, 
			top:html.offsetTop,
			height:html.offsetHeight,
			width:html.offsetWidth,
			parent:this._contentobj
		};
	}
};



smdui.protoUI({
	name:"dataview",
	$init:function(config){
		if (config.sizeToContent)
			//method need to be called before data-loaders
			//so we are using unshift to place it at start
			this.$ready.unshift(this._after_init_call);
		var prerender = config.prerender || this.defaults.prerender;
		if (prerender === false || (prerender !== true && config.height !== "auto" && !config.autoheight))
			smdui.extend(this, smdui.VirtualRenderStack, true);
		if (config.autoheight)
			config.scroll = false;

		this._contentobj.className+=" smdui_dataview";

		this._viewobj.setAttribute("role", "listbox");
	},
	_after_init_call:function(){
		var test = smdui.html.create("DIV",0,this.type.template({}));
		test.style.position="absolute";
		document.body.appendChild(test);
		this.type.width = test.offsetWidth;
		this.type.height = test.offsetHeight;
		
		smdui.html.remove(test);
	},
	defaults:{
		scroll:true,
		datafetch:50,
		navigation:true
	},
	_id:"smdui_f_id",
	_itemClassName:"smdui_dataview_item",
	on_click:{
		smdui_dataview_item:function(e,id){ 
			if (this._settings.select){
				if (this._settings.select=="multiselect" || this._settings.multiselect)
					this.select(id, false, ((this._settings.multiselect == "touch") || e.ctrlKey || e.metaKey), e.shiftKey); 	//multiselection
				else
					this.select(id);
			}
		}		
	},
	on_dblclick:{
	},
	on_mouse_move:{
	},
	type:{
		//normal state of item
		template:smdui.template("#value#"),
		//in case of dyn. loading - temporary spacer
		templateLoading:smdui.template("Loading..."),
		width:160,
		height:50,
		classname:function(obj, common, marks){
			var css = "smdui_dataview_item ";

			if (common.css) css +=common.css+" ";
			if (obj.$css){
				if (typeof obj.$css == "object")
					obj.$css = smdui.html.createCss(obj.$css);
				css +=obj.$css+" ";
			}
			if (marks && marks.$css) css +=marks.$css+" ";
			
			return css;
		},
		aria:function(obj, common, marks){
			return 'role="option"'+(marks && marks.smdui_selected?' aria-selected="true" tabindex="0"':' tabindex="-1"');
		},
		templateStart:smdui.template('<div smdui_f_id="#id#" class="{common.classname()}" {common.aria()} style="width:{common.width}px; height:{common.height}px; float:left; overflow:hidden;">'),
		templateEnd:smdui.template("</div>")
		
	},
	_calck_autoheight:function(width){
		return (this._settings.height = this.type.height * Math.ceil( this.data.count() / Math.floor(width / this.type.width)));
	},
	autoheight_setter:function(mode){
		if (mode){
			this.data.attachEvent("onStoreLoad", smdui.bind(this.resize, this));
			this._contentobj.style.overflowY = "hidden";
		}
		return mode;
	},
	$getSize:function(dx, dy){
		if ((this._settings.xCount >0) && this.type.width != "auto" && !this._autowidth)
			this._settings.width = this.type.width*this._settings.xCount + (this._scroll_y?smdui.ui.scrollSize:0);
		if (this._settings.yCount && this.type.height != "auto")
			this._settings.height = this.type.height*this._settings.yCount;

		var width = this._settings.width || this._content_width;
		if (this._settings.autoheight && width){
			this._calck_autoheight(width);
			this.scroll_setter(false);	
		}
		return smdui.ui.view.prototype.$getSize.call(this, dx, dy);		
	},
	_recalk_counts:function(){
		var render = false;
		if (this._settings.yCount && this.type.height == "auto"){
			this.type.height = Math.floor(this._content_height/this._settings.yCount);
			render = true;
		}
		if (this._settings.xCount && (this.type.width == "auto"||this._autowidth)){
			this._autowidth = true; //flag marks that width was set to "auto" initially
			this.type.width = Math.floor(this._content_width/this._settings.xCount);
			render = true;
		} else 
			this._autowidth = false;

		return render;
	},
	$setSize:function(x,y){
		if (smdui.ui.view.prototype.$setSize.call(this, x, y)){
			if (this._settings.autoheight && this._calck_autoheight() != this._content_height)
				return smdui.delay(this.resize, this);

			if (this._recalk_counts() || this._render_visible_rows)
				this.render();
		}
	}
}, smdui.DataMove, smdui.DragItem, smdui.MouseEvents, smdui.KeysNavigation, smdui.SelectionModel, smdui.Scrollable, smdui.CustomPrint, smdui.ui.proto);



smdui.DataDriver.htmltable={

	//convert json string to json object if necessary
	toObject:function(data){
		data = smdui.toNode(data);
		smdui.assert(data, "table is not found");
		smdui.assert(data.tagName.toLowerCase() === 'table', "Incorrect table object");

		var tr = data.rows;
		smdui.html.remove(data);
		return tr;
	},
	//get array of records
	getRecords:function(data){
		var new_data = [];
		//skip header rows if necessary
		var i = (data[0] && data[0]._smdui_skip)?1:0;

		for (; i < data.length; i++)
			new_data.push(data[i]);
		return new_data;
	},
	//get hash of properties for single record
	getDetails:function(data){
		var td = data.getElementsByTagName('td');
		data = {};
		//get hash of properties for single record, data named as "data{index}"
		for (var i=0; i < td.length; i++) {
			data['data' + i] = td[i].innerHTML;
		}
		return data;
	},
	//get count of data and position at which new data need to be inserted
	getInfo:function(data){
		// dyn loading is not supported for htmltable
		return { 
			size:0,
			from:0
		};
	},
	getOptions:function(){},

	/*! gets header from first table row
	 **/
	getConfig: function(data) {
		var columns = [];
		var td = data[0].getElementsByTagName('th');
		if (td.length) data[0]._smdui_skip = true;
		for (var i = 0; i < td.length; i++) {
			var col = {
				id: 'data' + i,
				header: this._de_json(td[i].innerHTML)
			};
			var attrs = this._get_attrs(td[i]);
			col = smdui.extend(col, attrs);
			columns.push(col);
		}
		return columns;
	},

	_de_json:function(str){
		var pos = str.indexOf("json://");
		
		if (pos != -1)
			str = JSON.parse(str.substr(pos+7));
		return str;
	},
	
	/*! gets hash of html-element attributes
	 **/
	_get_attrs: function(el) {
		var attr = el.attributes;
		var hash = {};
		for (var i = 0; i < attr.length; i++) {
			hash[attr[i].nodeName] = this._de_json(attr[i].nodeValue);
		}
		hash.width = parseInt(hash.width, 10);
		return hash;
	}
};
smdui.protoUI({
	name:"vscroll",
	defaults:{
		scroll:"x",
		scrollStep:40,
		scrollPos:0,
		scrollSize:18,
		scrollVisible:1,
		zoom:1
	},
	$init:function(config){
		var dir = config.scroll||"x";
		var node = this._viewobj = smdui.toNode(config.container);
		node.className += " smdui_vscroll_"+dir;
		node.innerHTML="<div class='smdui_vscroll_body'></div>";
		smdui._event(node,"scroll", this._onscroll,{bind:this});

		this._last_set_size = 0;
		this._last_scroll_pos = 0;
	},
	reset:function(){
		this._last_scroll_pos = this.config.scrollPos = 0;
		this._viewobj[this.config.scroll == "x"?"scrollLeft":"scrollTop"] = 0;
	},
	_check_quantum:function(value){
		if (value>1500000){
			this._settings.zoom = Math.floor(value/1500000)+1;
			this._zoom_limit = value-this._last_set_size;
			value = Math.floor(value/this._settings.zoom)+this._last_set_size;
		} else {
			this._settings.zoom = 1;
			this._zoom_limit = Infinity;
		}
		return value;
	},	
	scrollWidth_setter:function(value){
		value = this._check_quantum(value);
		this._viewobj.firstChild.style.width = value+"px";
		return value;		
	},
	scrollHeight_setter:function(value){
		value = this._check_quantum(value);
		this._viewobj.firstChild.style.height = value+"px";
		return value;
	},
	sizeTo:function(value, top, bottom){
		value = value-(top||0)-(bottom||0);

		var width = this._settings.scrollSize;
		//IEFix
		//IE doesn't react on scroll-click if it has not at least 1 px of visible content
		if (smdui.env.isIE && width)
			width += 1;
		if (!width && this._settings.scrollVisible && !smdui.env.$customScroll){
			this._viewobj.style.pointerEvents="none";
			width = 14;
		}

		if (!width){
			this._viewobj.style.display = 'none';
		} else {
			this._viewobj.style.display = 'block';
			if (top)
				this._viewobj.style.marginTop = top+ "px";
			this._viewobj.style[this._settings.scroll == "x"?"width":"height"] =  Math.max(0,value)+"px";
			this._viewobj.style[this._settings.scroll == "x"?"height":"width"] = width+"px";
		}

		this._last_set_size = value;
	},
	getScroll:function(){
		return this._settings.scrollPos*this._settings.zoom;
	},
	getSize:function(){
		return (this._settings.scrollWidth||this._settings.scrollHeight)*this._settings.zoom;
	},
	scrollTo:function(value){
		if (value<0)
			value = 0;
		var config = this._settings;

		value = Math.min(((config.scrollWidth||config.scrollHeight)-this._last_set_size)*config.zoom, value);

		if (value < 0) value = 0;
		var svalue = value/config.zoom;

		if (this._last_scroll_pos != svalue){
			this._viewobj[config.scroll == "x"?"scrollLeft":"scrollTop"] = svalue;
			this._onscroll_inner(svalue);
			return true;
		}
	},
	_onscroll:function(){	
		var x = this._viewobj[this._settings.scroll == "x"?"scrollLeft":"scrollTop"];
		if (x != this._last_scroll_pos)
			this._onscroll_inner(x);
	},
	_onscroll_inner:function(value){
		this._last_scroll_pos = value;
		this._settings.scrollPos = (Math.min(this._zoom_limit, value*this._settings.zoom) || 0);

		this.callEvent("onScroll",[this._settings.scrollPos]);
	},
	activeArea:function(area, x_mode){
		this._x_scroll_mode = x_mode;
		smdui._event(area,(smdui.env.isIE8 ? "mousewheel" : "wheel"),this._on_wheel,{bind:this});
		this._add_touch_events(area);
	},

	_add_touch_events: function(area){
		if(!smdui.env.touch && window.navigator.pointerEnabled){
			smdui.html.addCss(area,"smdui_scroll_touch_ie",true);
			smdui._event(area, "pointerdown", function(e){
				if(e.pointerType == "touch" || e.pointerType == "pen"){
					this._start_context = smdui.Touch._get_context_m(e);
					this._start_scroll_pos = this._settings.scrollPos;
				}
			},{bind:this});

			smdui.event(document.body, "pointermove", function(e){
				var scroll;
				if(this._start_context){
					this._current_context = smdui.Touch._get_context_m(e);
					if(this._settings.scroll == "x" ){
						scroll = this._current_context.x - this._start_context.x;
					}
					else if(this._settings.scroll == "y"){
						scroll = this._current_context.y - this._start_context.y;
					}
					if(scroll && Math.abs(scroll) > 5){
						this.scrollTo(this._start_scroll_pos - scroll);
					}
				}
			},{bind:this});
			smdui.event(window, "pointerup", function(e){
				if(this._start_context){
					this._start_context = this._current_context = null;
				}
			},{bind:this});
		}

	},
	_on_wheel:function(e){
		var dir = 0;
		var step = e.deltaMode === 0 ? 30 : 1;

		if (smdui.env.isIE8)
			dir = e.detail = -e.wheelDelta / 30;

		if (e.deltaX && Math.abs(e.deltaX) > Math.abs(e.deltaY)){
			//x-scroll
			if (this._x_scroll_mode && this._settings.scrollVisible)
				dir = e.deltaX / step;
		} else {
			//y-scroll
			if (!this._x_scroll_mode && this._settings.scrollVisible){
				if (smdui.isUndefined(e.deltaY))
					dir = e.detail;
				else
					dir = e.deltaY / step;
			}
		}

		// Safari requires target preserving
		// (used in _check_rendered_cols of DataTable)
		if(smdui.env.isSafari)
			this._scroll_trg = e.target|| e.srcElement;

		if (dir)
			if (this.scrollTo(this._settings.scrollPos + dir*this._settings.scrollStep))
				return smdui.html.preventEvent(e);

	}
}, smdui.EventSystem, smdui.Settings);

smdui.Number={
	format: function(value, config){ 
		if (value === "" || typeof value === "undefined") return value;
		
		config = config||smdui.i18n;
		value = parseFloat(value);

		var sign = value < 0 ? "-":"";
		value = Math.abs(value);

		var str = value.toFixed(config.decimalSize).toString();
		str = str.split(".");

		var int_value = "";
		if (config.groupSize){
			var step = config.groupSize;
			var i=str[0].length;
			do {
				i-=step;
				var chunk = (i>0)?str[0].substr(i,step):str[0].substr(0,step+i);
				int_value = chunk+(int_value?config.groupDelimiter+int_value:"");
			} while(i>0);
		} else
			int_value = str[0];

		if (config.decimalSize)
			return sign + int_value + config.decimalDelimiter + str[1];
		else
			return sign + int_value;
	},
	numToStr:function(config){
		return function(value){
			return smdui.Number.format(value, config);
		};
	}
};

smdui.Date={
	startOnMonday:false,

	toFixed:function(num){
		if (num<10)	return "0"+num;
		return num;
	},
	weekStart:function(date){
		date = this.copy(date);

		var shift=date.getDay();
		if (this.startOnMonday){
			if (shift===0) shift=6;
			else shift--;
		}
		return this.datePart(this.add(date,-1*shift,"day"));
	},
	monthStart:function(date){
		date = this.copy(date);

		date.setDate(1);
		return this.datePart(date);
	},
	yearStart:function(date){
		date = this.copy(date);

		date.setMonth(0);
		return this.monthStart(date);
	},
	dayStart:function(date){
		return this.datePart(date, true);
	},
	dateToStr:function(format,utc){
		if (typeof format == "function") return format;

		if(smdui.env.strict){
			return function(date){
				var str = "";
				var lastPos = 0;
				format.replace(/%[a-zA-Z]/g,function(s,pos){
					str += format.slice(lastPos,pos);
					var fn = function(date){
						if( s == "%d")  return smdui.Date.toFixed(date.getDate());
						if( s == "%m")  return smdui.Date.toFixed((date.getMonth()+1));
						if( s == "%j")  return date.getDate();
						if( s == "%n")  return (date.getMonth()+1);
						if( s == "%y")  return smdui.Date.toFixed(date.getFullYear()%100);
						if( s == "%Y")  return date.getFullYear();
						if( s == "%D")  return smdui.i18n.calendar.dayShort[date.getDay()];
						if( s == "%l")  return smdui.i18n.calendar.dayFull[date.getDay()];
						if( s == "%M")  return smdui.i18n.calendar.monthShort[date.getMonth()];
						if( s == "%F")  return smdui.i18n.calendar.monthFull[date.getMonth()];
						if( s == "%h")  return smdui.Date.toFixed((date.getHours()+11)%12+1);
						if( s == "%g")  return ((date.getHours()+11)%12+1);
						if( s == "%G")  return date.getHours();
						if( s == "%H")  return smdui.Date.toFixed(date.getHours());
						if( s == "%i")  return smdui.Date.toFixed(date.getMinutes());
						if( s == "%a")  return (date.getHours()>11?smdui.i18n.pm[0]:smdui.i18n.am[0]);
						if( s == "%A")  return (date.getHours()>11?smdui.i18n.pm[1]:smdui.i18n.am[1]);
						if( s == "%s")  return smdui.Date.toFixed(date.getSeconds());
						if( s == "%S")	return smdui.Date.toFixed(date.getMilliseconds());
						if( s == "%W")  return smdui.Date.toFixed(smdui.Date.getISOWeek(date));
						if( s == "%c"){
							var str = date.getFullYear();
							str += "-"+smdui.Date.toFixed((date.getMonth()+1));
							str += "-"+smdui.Date.toFixed(date.getDate());
							str += "T";
							str += smdui.Date.toFixed(date.getHours());
							str += ":"+smdui.Date.toFixed(date.getMinutes());
							str += ":"+smdui.Date.toFixed(date.getSeconds());
							return str;
						}
						return s;
					};
					str += fn(date);
					lastPos = pos + 2;
				});
				str += format.slice(lastPos,format.length);
				return str;
			};

		}

		format=format.replace(/%[a-zA-Z]/g,function(a){
			switch(a){
				case "%d": return "\"+smdui.Date.toFixed(date.getDate())+\"";
				case "%m": return "\"+smdui.Date.toFixed((date.getMonth()+1))+\"";
				case "%j": return "\"+date.getDate()+\"";
				case "%n": return "\"+(date.getMonth()+1)+\"";
				case "%y": return "\"+smdui.Date.toFixed(date.getFullYear()%100)+\""; 
				case "%Y": return "\"+date.getFullYear()+\"";
				case "%D": return "\"+smdui.i18n.calendar.dayShort[date.getDay()]+\"";
				case "%l": return "\"+smdui.i18n.calendar.dayFull[date.getDay()]+\"";
				case "%M": return "\"+smdui.i18n.calendar.monthShort[date.getMonth()]+\"";
				case "%F": return "\"+smdui.i18n.calendar.monthFull[date.getMonth()]+\"";
				case "%h": return "\"+smdui.Date.toFixed((date.getHours()+11)%12+1)+\"";
				case "%g": return "\"+((date.getHours()+11)%12+1)+\"";
				case "%G": return "\"+date.getHours()+\"";
				case "%H": return "\"+smdui.Date.toFixed(date.getHours())+\"";
				case "%i": return "\"+smdui.Date.toFixed(date.getMinutes())+\"";
				case "%a": return "\"+(date.getHours()>11?smdui.i18n.pm[0]:smdui.i18n.am[0])+\"";
				case "%A": return "\"+(date.getHours()>11?smdui.i18n.pm[1]:smdui.i18n.am[1])+\"";
				case "%s": return "\"+smdui.Date.toFixed(date.getSeconds())+\"";
				case "%S": return "\"+smdui.Date.toFixed(date.getMilliseconds())+\"";
				case "%W": return "\"+smdui.Date.toFixed(smdui.Date.getISOWeek(date))+\"";
				case "%c":
					var str = "\"+date.getFullYear()+\"";
					str += "-\"+smdui.Date.toFixed((date.getMonth()+1))+\"";
					str += "-\"+smdui.Date.toFixed(date.getDate())+\"";
					str += "T";
					str += "\"+smdui.Date.toFixed(date.getHours())+\"";
					str += ":\"+smdui.Date.toFixed(date.getMinutes())+\"";
					str += ":\"+smdui.Date.toFixed(date.getSeconds())+\"";
					if(utc === true)
						str += "Z";
					return str;

				default: return a;
			}
		});
		if (utc===true) format=format.replace(/date\.get/g,"date.getUTC");
		return new Function("date","if (!date) return ''; if (!date.getMonth) date=smdui.i18n.parseFormatDate(date);  return \""+format+"\";");
	},
	strToDate:function(format,utc){
		if (typeof format == "function") return format;

		var mask=format.match(/%[a-zA-Z]/g);
		var splt="var temp=date.split(/[^0-9a-zA-Z]+/g);";
		var i,t,s;

		if(!smdui.i18n.calendar.monthShort_hash){
			s = smdui.i18n.calendar.monthShort;
			t = smdui.i18n.calendar.monthShort_hash = {};
			for (i = 0; i < s.length; i++)
				t[s[i]]=i;

			s = smdui.i18n.calendar.monthFull;
			t = smdui.i18n.calendar.monthFull_hash = {};
			for (i = 0; i < s.length; i++)
				t[s[i]]=i;
		}

		if(smdui.env.strict){
			return function(date){
				if (!date) return '';
				if (typeof date == 'object') return date;
				var temp=date.split(/[^0-9a-zA-Z]+/g);
				var set=[0,0,1,0,0,0,0];
				for (i=0; i<mask.length; i++){
					var a = mask[i];
					if( a ==  "%y")
						set[0]=temp[i]*1+(temp[i]>30?1900:2000);
					else if( a ==  "%Y"){
						set[0]=(temp[i]||0)*1; if (set[0]<30) set[0]+=2000;
					}
					else if( a == "%n" || a == "%m")
						set[1]=(temp[i]||1)-1;
					else if( a ==  "%M")
						set[1]=smdui.i18n.calendar.monthShort_hash[temp[i]]||0;
					else if( a ==  "%F")
						set[1]=smdui.i18n.calendar.monthFull_hash[temp[i]]||0;
					else if( a == "%j" || a == "%d")
						set[2]=temp[i]||1;
					else if( a == "%g" || a == "%G" || a == "%h" || a == "%H")
						set[3]=temp[i]||0;
					else if( a == "%a")
							set[3]=set[3]%12+((temp[i]||'')==smdui.i18n.am[0]?0:12);
					else if( a == "%A")
						set[3]=set[3]%12+((temp[i]||'')==smdui.i18n.am[1]?0:12);
					else if( a ==  "%i")
						set[4]=temp[i]||0;
					else if( a ==  "%s")
						set[5]=temp[i]||0;
					else if( a ==  "%S")
						set[6]=temp[i]||0;
					else if( a ==  "%c"){
						var reg = /(\d+)-(\d+)-(\d+)T(\d+):(\d+):(\d+)(\+.*|)/g;
						var res = reg.exec(date);
						set[0]= (res[1]||0)*1; if (set[0]<30) set[0]+=2000;
						set[1]= (res[2]||1)-1;
						set[2]= res[3]||1;
						set[3]= res[4]||0;
						set[4]= res[5]||0;
						set[5]= res[6]||0;
					}
				}
				if(utc)
					return new Date(Date.UTC(set[0],set[1],set[2],set[3],set[4],set[5], set[6]));
				return new Date(set[0],set[1],set[2],set[3],set[4],set[5], set[6]);
			};
		}

		for (i=0; i<mask.length; i++){
			switch(mask[i]){
				case "%j":
				case "%d": splt+="set[2]=temp["+i+"]||1;";
					break;
				case "%n":
				case "%m": splt+="set[1]=(temp["+i+"]||1)-1;";
					break;
				case "%y": splt+="set[0]=temp["+i+"]*1+(temp["+i+"]>30?1900:2000);";
					break;
				case "%g":
				case "%G":
				case "%h": 
				case "%H":
							splt+="set[3]=temp["+i+"]||0;";
					break;
				case "%i":
							splt+="set[4]=temp["+i+"]||0;";
					break;
				case "%Y":  splt+="set[0]=(temp["+i+"]||0)*1; if (set[0]<30) set[0]+=2000;";
					break;
				case "%a":
					splt+= "set[3]=set[3]%12+(temp["+i+"]==smdui.i18n.am[0]?0:12);";
					break;
				case "%A":
					splt+= "set[3]=set[3]%12+(temp["+i+"]==smdui.i18n.am[1]?0:12);";
					break;					
				case "%s":  splt+="set[5]=temp["+i+"]||0;";
					break;
				case "%S":  splt+="set[6]=temp["+i+"]||0;";
					break;
				case "%M":  splt+="set[1]=smdui.i18n.calendar.monthShort_hash[temp["+i+"]]||0;";
					break;
				case "%F":  splt+="set[1]=smdui.i18n.calendar.monthFull_hash[temp["+i+"]]||0;";
					break;
				case "%c":
					splt+= "var res = date.split('T');";
					splt+= "if(res[0]){ var d = res[0].split('-');";
					splt+= "set[0]= (d[0]||0)*1; if (set[0]<30) set[0]+=2000;";
					splt+= "set[1]= (d[1]||1)-1;";
					splt+= "set[2]= d[2]||1;}";
					splt+= "if(res[1]){ var t = res[1].split(':');";
					splt+= "set[3]= t[0]||0;";
					splt+= "set[4]= t[1]||0;";
					splt+= "set[5]= parseInt(t[2])||0;}";
					break;
				default:
					break;
			}
		}
		var code ="set[0],set[1],set[2],set[3],set[4],set[5], set[6]";
		if (utc) code =" Date.UTC("+code+")";
		return new Function("date","if (!date) return ''; if (typeof date == 'object') return date; var set=[0,0,1,0,0,0,0]; "+splt+" return new Date("+code+");");
	},
		
	getISOWeek: function(ndate) {
		if(!ndate) return false;
		var nday = ndate.getDay();
		if (nday === 0) {
			nday = 7;
		}
		var first_thursday = new Date(ndate.valueOf());
		first_thursday.setDate(ndate.getDate() + (4 - nday));
		var year_number = first_thursday.getFullYear(); // year of the first Thursday
		var ordinal_date = Math.floor( (first_thursday.getTime() - new Date(year_number, 0, 1).getTime()) / 86400000); //ordinal date of the first Thursday - 1 (so not really ordinal date)
		var weekNumber = 1 + Math.floor( ordinal_date / 7);	
		return weekNumber;
	},
	
	getUTCISOWeek: function(ndate){
		return this.getISOWeek(ndate);
	},
	_correctDate: function(d,d0,inc,checkFunc){
		if(!inc)
			return;
		var incorrect = checkFunc(d,d0);
		if(incorrect){
			var i = (inc>0?1:-1);

			while(incorrect){
				d.setHours(d.getHours()+i);
				incorrect = checkFunc(d,d0);
				i += (inc>0?1:-1);
			}
		}
	},
	add:function(date,inc,mode,copy){
		if (copy) date = this.copy(date);
		var d = smdui.Date.copy(date);
		switch(mode){
			case "day":
				date.setDate(date.getDate()+inc);
				this._correctDate(date,d,inc,function(d,d0){
					return 	smdui.Date.datePart(d0,true).valueOf()== smdui.Date.datePart(d,true).valueOf();
				});
				break;
			case "week":
				date.setDate(date.getDate()+7*inc);
				this._correctDate(date,d,7*inc,function(d,d0){
					return 	smdui.Date.datePart(d0,true).valueOf()== smdui.Date.datePart(d,true).valueOf();
				});
				break;
			case "month":
				date.setMonth(date.getMonth()+inc);
				this._correctDate(date,d,inc,function(d,d0){
					return 	d0.getMonth() == d.getMonth() && d0.getYear() == d.getYear();
				});
				break;
			case "year":
				date.setYear(date.getFullYear()+inc);
				this._correctDate(date,d,inc,function(d,d0){
					return 	d0.getFullYear() == d.getFullYear();
				});
				break;
			case "hour":
				date.setHours(date.getHours()+inc);
				this._correctDate(date,d,inc,function(d,d0){
					return 	d0.getHours() == d.getHours() && smdui.Date.datePart(d0,true)== smdui.Date.datePart(d,true);
				});
				break;
			case "minute": 	date.setMinutes(date.getMinutes()+inc); break;
			default:
				smdui.Date.add[mode](date, inc, mode);
				break;
		}
		return date;
	},
	datePart:function(date, copy){
		if (copy) date = this.copy(date);

		// workaround for non-existent hours
		var d = this.copy(date);
		d.setHours(0);
		if(d.getDate()!=date.getDate()){
			date.setHours(1);
		}
		else{
			date.setHours(0);
		}

		date.setMinutes(0);
		date.setSeconds(0);
		date.setMilliseconds(0);
		return date;
	},
	timePart:function(date, copy){
		if (copy) date = this.copy(date);
		return (date.valueOf()/1000 - date.getTimezoneOffset()*60)%86400;
	},
	copy:function(date){
		return new Date(date.valueOf());
	},
	equal:function(a,b){
		if (!a || !b) return false;
		return a.valueOf() === b.valueOf();
	},
	isHoliday:function(day){ 
		day = day.getDay();
		if (day === 0 || day==6) return "smdui_cal_event"; 
	}
};


smdui.i18n = {
	_dateMethods:["fullDateFormat", "timeFormat", "dateFormat", "longDateFormat", "parseFormat", "parseTimeFormat"],
	parseFormat:"%Y-%m-%d %H:%i",
	parseTimeFormat:"%H:%i",
	numberFormat:smdui.Number.format,
	priceFormat:function(value){ return smdui.i18n._price_format(smdui.i18n.numberFormat(value, smdui.i18n._price_settings)); },

	setLocale:function(locale){
		var extend = function(base,source){
			for (var method in source){
				if(typeof(source[method]) == "object" && !smdui.isArray(source[method])){
					if(!base[method]){
						base[method] = {};
					}
					extend(base[method],source[method]);
				}
				else
					base[method] = source[method];
			}
		};

		if (typeof locale == "string")
			locale = this.locales[locale];
		if (locale){
			extend(this, locale);
		}
		var helpers = smdui.i18n._dateMethods;
		for( var i=0; i<helpers.length; i++){
			var key = helpers[i];
			var utc = smdui.i18n[key+"UTC"];
			smdui.i18n[key+"Str"] = smdui.Date.dateToStr(smdui.i18n[key], utc);
			smdui.i18n[key+"Date"] = smdui.Date.strToDate(smdui.i18n[key], utc);
		}

		this._price_format = smdui.template(this.price);
		this._price_settings = this.priceSettings || this;

		this.intFormat = smdui.Number.numToStr({ groupSize:this.groupSize, groupDelimiter:this.groupDelimiter, decimalSize : 0});
	}
};


smdui.i18n.locales={};
smdui.i18n.locales["zh-CN"] = {
    groupDelimiter: ",",
    groupSize: 3,
    decimalDelimiter: ".",
    decimalSize: 2,
    dateFormat: "%Y/%m/%j",
    timeFormat: "%G:%i",
    longDateFormat: "%Y'年'%m'月'%j'日'",
    fullDateFormat: "%Y'年'%m'月'%j'日' %G:%i",
    am: ["上午", "上午"],
    pm: ["下午", "下午"],
    price: "¥{obj}",
    priceSettings: {
        groupDelimiter: ",",
        groupSize: 3,
        decimalDelimiter: ".",
        decimalSize: 2
    },
    fileSize: ["b", "Kb", "Mb", "Gb", "Tb", "Pb", "Eb"],
    calendar: {
        monthFull: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],
        monthShort: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"],
        dayFull: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
        dayShort: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
        hours: "小时",
        minutes: "分钟",
        done: "完成",
        clear: "清除",
        today: "今天"
    },

    controls: {
        select: "选择",
        invalidMessage: "无效的输入值"
    },
    dataExport: {
        page: "页",
        of: "从"
    },
    PDFviewer: {
        of: "从",
        automaticZoom: "自动设置页面大小",
        actualSize: "实际尺寸",
        pageFit: "页面大小",
        pageWidth: "页面宽度",
        pageHeight: "页面高度"
    },
    aria: {
        calendar: "日历",
        increaseValue: "增加值",
        decreaseValue: "减少值",
        navMonth: ["上个月", "下个月"],
        navYear: ["上年", "明年"],
        navDecade: ["过去十年", "下个十年"],
        dateFormat: "%Y'年'%m'月'%j'日'",
        monthFormat: "%Y'年'%m'月",
        yearFormat: "%Y'年",
        hourFormat: "小时: %G",
        minuteFormat: "分钟: %i",
        removeItem: "删除元素",
        pages: ["第一页", "上一页", "下一页", "最后一页"],
        page: "页",
        headermenu: "标题菜单",
        openGroup: "打开栏目组",
        closeGroup: "关闭栏目组",
        closeTab: "关闭标签",
        showTabs: "显示更多选项卡",
        resetTreeMap: "回到原来的视图",
        navTreeMap: "升级",
        nextTab: "下一个标签",
        prevTab: "前一个标签",
        multitextSection: "加元",
        multitextextraSection: "删除元素",
        showChart: "显示图表",
        hideChart: "隐藏图表",
        resizeChart: "调整图"
    },
    richtext: {
        underline: "强调",
        bold: "粗體",
        italic: "斜体"
    }
};
smdui.i18n.setLocale("zh-CN");


smdui.protoUI({
	name:"resizearea",
	defaults:{
		dir:"x"
	},
	$init:function(config){
		var dir = config.dir||"x";
		var node = smdui.toNode(config.container);
        var size = (dir=="x"?"width":"height");
		var margin = (config.margin? config.margin+"px":0);

		this._key_property = (dir == "x"?"left":"top");

		this._viewobj = smdui.html.create("DIV",{
			"class"	: "smdui_resize_area smdui_dir_"+dir
		});
		//[[COMPAT]] FF12 can produce 2 move events
		smdui._event(this._viewobj, smdui.env.mouse.down, smdui.html.stopEvent);

		if(margin){
			if(dir=="x")
				margin = margin+" 0 "+margin;
			else
				margin = "0 "+margin+" 0 "+margin;
		}
		this._dragobj = smdui.html.create("DIV",{
			"class"	: "smdui_resize_handle_"+dir,
			 "style" : (margin?"padding:"+margin:"")
		},"<div class='smdui_handle_content'></div>");

		this._originobj = smdui.html.create("DIV",{
			"class"	: "smdui_resize_origin_"+dir
		});

        if(config[size]){
            this._originobj.style[size] = config[size]+(config.border?1:0)+"px";
            this._dragobj.style[size] = config[size]+"px";
        }
		if (config.cursor)
			this._dragobj.style.cursor = this._originobj.style.cursor = this._viewobj.style.cursor = config.cursor;
		this._moveev =	smdui.event(node, smdui.env.mouse.move, this._onmove, {bind:this});
		this._upev =	smdui.event(document.body, smdui.env.mouse.up, this._onup, {bind:this});

		this._dragobj.style[this._key_property] = this._originobj.style[this._key_property] = config.start+"px";

		node.appendChild(this._viewobj);
		node.appendChild(this._dragobj);
		node.appendChild(this._originobj);
	},
	_onup:function(){

		this.callEvent("onResizeEnd", [this._last_result]);

		smdui.eventRemove(this._moveev);
		smdui.eventRemove(this._upev);

		smdui.html.remove(this._viewobj);
		smdui.html.remove(this._dragobj);
		smdui.html.remove(this._originobj);
		this._viewobj = this._dragobj = this._originobj = null;
	},
	_onmove:function(e){
		var pos = smdui.html.pos(e);
		this._last_result = (this._settings.dir == "x" ? pos.x : pos.y)+this._settings.start-this._settings.eventPos;
		this._dragobj.style[this._key_property] = this._last_result+"px";
		this.callEvent("onResize", [this._last_result]);
	}
}, smdui.EventSystem, smdui.Settings);

smdui.csv = {
	escape:true,
	delimiter:{
		rows: "\n",
		cols: "\t"
	},
	parse:function(text, sep){
		sep = sep||this.delimiter;
		if (!this.escape)
			return this._split_clip_data(text, sep);

		var lines = text.replace(/\n$/,"").split(sep.rows);

		var i = 0;
		while (i < lines.length - 1) {
			if (this._substr_count(lines[i], '"') % 2 === 1) {
				lines[i] += sep.rows + lines[i + 1];
				delete lines[i + 1];
				i++;
			}
			i++;
		}
		var csv = [];
		for (i = 0; i < lines.length; i++) {
			if (typeof(lines[i]) !== 'undefined') {
				var line = lines[i].split(sep.cols);
				for (var j = 0; j < line.length; j++) {
					if (line[j].indexOf('"') === 0)
						line[j] = line[j].substr(1, line[j].length - 2);
					line[j] = line[j].replace('""', '"');
				}
				csv.push(line);
			}
		}
		return csv;
	},
	_split_clip_data: function(text, sep) {
		var lines = text.split(sep.rows);
		for (var i = 0; i < lines.length; i++) {
			lines[i] = lines[i].split(sep.cols);
		}
		return lines;
	},
	/*! counts how many occurances substring in string **/
	_substr_count: function(string, substring) {
		var arr = string.split(substring);
		return arr.length - 1;
	},
	stringify:function(data, sep){
		sep = sep||this.delimiter;

		if (!this.escape){
			for (var i = 0; i < data.length; i++)
				data[i] = data[i].join(sep.cols);
			return data.join(sep.rows);
		}

		var reg = /\n|\"|;|,/;
		for (var i = 0; i < data.length; i++) {
			for (var j = 0; j < data[i].length; j++) {
				if (reg.test(data[i][j])) {
					data[i][j] = data[i][j].replace(/"/g, '""');
					data[i][j] = '"' + data[i][j] + '"';
				}
			}
			data[i] = data[i].join(sep.cols);
		}
		data = data.join(sep.rows);
		return data;
	}
};

if (!smdui.storage)
    smdui.storage = {};

smdui.storage.local = {
    put: function (name, data) {
        if (name && window.JSON && window.localStorage) {
            window.localStorage.setItem(name, smdui.stringify(data));
        }
    },
    get: function (name) {
        if (name && window.JSON && window.localStorage) {
            var json = window.localStorage.getItem(name);
            if (!json)
                return null;
            return smdui.DataDriver.json.toObject(json);
        } else
            return null;
    },
    remove: function (name) {
        if (name && window.JSON && window.localStorage) {
            window.localStorage.removeItem(name);
        }
    },
    clear: function () {
        window.localStorage.clear();
    }
};

smdui.storage.session = {
    put: function (name, data) {
        if (name && window.JSON && window.sessionStorage) {
            window.sessionStorage.setItem(name, smdui.stringify(data));
        }
    },
    get: function (name) {
        if (name && window.JSON && window.sessionStorage) {
            var json = window.sessionStorage.getItem(name);
            if (!json)
                return null;
            return smdui.DataDriver.json.toObject(json);
        } else
            return null;
    },
    remove: function (name) {
        if (name && window.JSON && window.sessionStorage) {
            window.sessionStorage.removeItem(name);
        }
    },
    clear: function () {
        window.sessionStorage.clear();
    }
};

smdui.storage.cookie = {
    put: function (name, data, domain, expires) {
        if (name && window.JSON) {
            document.cookie = name + "=" + escape(smdui.stringify(data)) +
                ((expires && (expires instanceof Date)) ? ";expires=" + expires.toUTCString() : "") +
                ((domain) ? ";domain=" + domain : "") +
                ((smdui.env.https) ? ";secure" : "");
        }
    },
    getRaw: function (check_name) {
        // first we'll split this cookie up into name/value pairs
        // note: document.cookie only returns name=value, not the other components
        var a_all_cookies = document.cookie.split(';');
        var a_temp_cookie = '';
        var cookie_name = '';
        var cookie_value = '';
        var b_cookie_found = false; // set boolean t/f default f

        for (var i = 0; i < a_all_cookies.length; i++) {
            // now we'll split apart each name=value pair
            a_temp_cookie = a_all_cookies[i].split('=');

            // and trim left/right whitespace while we're at it
            cookie_name = a_temp_cookie[0].replace(/^\s+|\s+$/g, '');

            // if the extracted name matches passed check_name
            if (cookie_name == check_name) {
                b_cookie_found = true;
                // we need to handle case where cookie has no value but exists (no = sign, that is):
                if (a_temp_cookie.length > 1) {
                    cookie_value = unescape(a_temp_cookie[1].replace(/^\s+|\s+$/g, ''));
                }
                // note that in cases where cookie is initialized but no value, null is returned
                return cookie_value;
            }
            a_temp_cookie = null;
            cookie_name = '';
        }
        if (!b_cookie_found) {
            return null;
        }
        return null;
    },
    get: function (name) {
        if (name && window.JSON) {
            var json = this.getRaw(name);
            if (!json)
                return null;
            return smdui.DataDriver.json.toObject(unescape(json));
        } else
            return null;
    },
    remove: function (name, domain) {
        if (name && this.getRaw(name))
            document.cookie = name + "=" + ((domain) ? ";domain=" + domain : "") + ";expires=Thu, 01-Jan-1970 00:00:01 GMT";
    },
    clear: function (domain) {
        var cookies = document.cookie.split(";");
        for (var i = 0; i < cookies.length; i++)
            document.cookie = /^[^=]+/.exec(cookies[i])[0] + "=" + ((domain) ? ";domain=" + domain : "") + ";expires=Thu, 01-Jan-1970 00:00:01 GMT";
    }
};


(function(){
var t = smdui.Touch = {
	config:{
		longTouchDelay:1000,
		scrollDelay:150,
		gravity:500,
		deltaStep:30,
		speed:"0ms",
		finish:1500,
		ellastic:true
	},
	limit:function(value){
		t._limited = value !== false;	
	},
	disable:function(){
		t._disabled = true;
	},
	enable:function(){
		t._disabled = false;
	},
	$init:function(){
		t.$init = function(){};

		smdui.event(document.body, mouse.down,	t._touchstart);
		smdui.event(document.body, mouse.move, 	t._touchmove);
		smdui.event(document.body, mouse.up, 	t._touchend);

		smdui.event(document.body,"dragstart",function(e){
			return smdui.html.preventEvent(e);
		});
		smdui.event(document.body,"touchstart",function(e){
			if (t._disabled || t._limited) return;
			//fast click mode for iOS
			//To have working form elements Android must not block event - so there are no fast clicks for Android
			//Selects still don't work with fast clicks
			if (smdui.env.isSafari) {
				var tag = e.srcElement.tagName.toLowerCase();
				if (tag == "input" || tag == "textarea" || tag == "select" || tag=="label")
					return true;

				t._fire_fast_event = true;
				return smdui.html.preventEvent(e);
			}
		});

		t._clear_artefacts();
		t._scroll = [null, null];
		t.$active = true;
	},
	_clear_artefacts:function(){
		t._start_context = t._current_context = t._prev_context = t._scroll_context = null;
		t._scroll_mode = t._scroll_node = t._scroll_stat = this._long_touched = null;
		//smdui.html.remove(t._scroll);
		//t._scroll = [null, null];
		t._delta = 	{ _x_moment:0, _y_moment:0, _time:0 };

		if (t._css_button_remove){
			smdui.html.removeCss(t._css_button_remove,"smdui_touch");
			t._css_button_remove = null;
		}
		
		window.clearTimeout(t._long_touch_timer);
		t._was_not_moved = true;
		t._axis_x = true;
		t._axis_y = true;
		if (!t._active_transion)
			t._scroll_end();
	},
	_touchend:function(e){
		if (t._start_context) {
			if (!t._scroll_mode) {
				if (!this._long_touched) {
					if (t._axis_y && !t._axis_x) {
						t._translate_event("onSwipeX");
					} else if (t._axis_x && !t._axis_y) {
						t._translate_event("onSwipeY");
					} else {
						if (smdui.env.isSafari && t._fire_fast_event) { //need to test for mobile ff and blackbery
							t._fire_fast_event = false;
							var target = t._start_context.target;

							//dark iOS magic, without delay it can skip repainting
							smdui.delay(function () {
								var click_event = document.createEvent('MouseEvents');
								click_event.initEvent('click', true, true);
								target.dispatchEvent(click_event);
							});

						}
					}
				}
			} else {


				var temp = t._get_matrix(t._scroll_node);
				var x = temp.e;
				var y = temp.f;
				var finish = t.config.finish;

				var delta = t._get_delta(e, true);
				var view = smdui.$$(t._scroll_node);

				var gravity = (view && view.$scroll ? view.$scroll.gravity : t.config.gravity);
				if (delta._time) {
					var nx = x + gravity * delta._x_moment / delta._time;
					var ny = y + gravity * delta._y_moment / delta._time;

					var cnx = t._scroll[0] ? t._correct_minmax(nx, false, false, t._scroll_stat.dx, t._scroll_stat.px) : x;
					var cny = t._scroll[1] ? t._correct_minmax(ny, false, false, t._scroll_stat.dy, t._scroll_stat.py) : y;


					var size = Math.max(Math.abs(cnx - x), Math.abs(cny - y));
					if (size < 150)
						finish = finish * size / 150;

					if (cnx != x || cny != y)
						finish = Math.round(finish * Math.max((cnx - x) / (nx - x), (cny - y) / (ny - y)));

					var result = {e: cnx, f: cny};


					var view = smdui.$$(t._scroll_node);
					if (view && view.adjustScroll)
						view.adjustScroll(result);


					//finish = Math.max(100,(t._fast_correction?100:finish));
					finish = Math.max(100, finish);


					if (x != result.e || y != result.f) {
						t._set_matrix(t._scroll_node, result.e, result.f, finish + "ms");
						if (t._scroll_master)
							t._scroll_master._sync_scroll(result.e, result.f, finish + "ms");
						t._set_scroll(result.e, result.f, finish + "ms");
					} else {
						t._scroll_end();
					}
				} else
					t._scroll_end();
			}
			t._translate_event("onTouchEnd");
			t._clear_artefacts();
		}
	},
	_touchmove:function(e){
		if (!t._scroll_context || !t._start_context) return;

		var	delta = t._get_delta(e);
		t._translate_event("onTouchMove");

		if (t._scroll_mode){
			t._set_scroll_pos(delta);
		} else {
			t._axis_x = t._axis_check(delta._x, "x", t._axis_x);
			t._axis_y = t._axis_check(delta._y, "y", t._axis_y);
			if (t._scroll_mode){
				var view = t._get_event_view("onBeforeScroll", true);
				if (view){
					var data = {};
					view.callEvent("onBeforeScroll",[data]);
					if (data.update){
						t.config.speed = data.speed;
						t.config.scale = data.scale;
					}
				}
				t._init_scroller(delta); //apply scrolling
			}
		}

		return smdui.html.preventEvent(e);
	},
	_set_scroll_pos:function(){
		if (!t._scroll_node) return;
		var temp = t._get_matrix(t._scroll_node);
		var be = temp.e, bf = temp.f;
		var prev = t._prev_context || t._start_context;

		var view = smdui.$$(t._scroll_node);
		var ellastic = (view&&view.$scroll)?view.$scroll.ellastic: t.config.ellastic;
		if (t._scroll[0])
			temp.e = t._correct_minmax( temp.e - prev.x + t._current_context.x , ellastic, temp.e, t._scroll_stat.dx, t._scroll_stat.px);
		if (t._scroll[1])
			temp.f = t._correct_minmax( temp.f - prev.y + t._current_context.y , ellastic, temp.f, t._scroll_stat.dy, t._scroll_stat.py);

		t._set_matrix(t._scroll_node, temp.e, temp.f, "0ms");
		if (t._scroll_master)
			t._scroll_master._sync_scroll(temp.e, temp.f, "0ms");
		t._set_scroll(temp.e, temp.f, "0ms");
	},
	_set_scroll:function(dx, dy, speed){
		
		var edx = t._scroll_stat.px/t._scroll_stat.dx * -dx;
		var edy = t._scroll_stat.py/t._scroll_stat.dy * -dy;
		if (t._scroll[0])
			t._set_matrix(t._scroll[0], edx, 0 ,speed);
		if (t._scroll[1])
			t._set_matrix(t._scroll[1], 0, edy ,speed);
	},
	scrollTo:function(node, x, y, speed){
		t._set_matrix(node,x,y,speed);
	},
	_set_matrix:function(node, xv, yv, speed){
		if(!t._in_anim_frame && window.setAnimationFrame){
			window.setAnimationFrame(function(){
				t._in_anim_frame = true;
				return t._set_matrix(node, xv, yv, speed);
			});
		}
		t._in_anim_frame = null;
		t._active_transion = true;
		if (node){
			var trans = t.config.translate || smdui.env.translate;
			node.style[smdui.env.transform] = trans+"("+Math.round(xv)+"px, "+Math.round(yv)+"px"+((trans=="translate3d")?", 0":"")+")";
			node.style[smdui.env.transitionDuration] = speed;
		}
	},
	_get_matrix:function(node){
		var matrix = window.getComputedStyle(node)[smdui.env.transform];
		var tmatrix;

		if (matrix == "none")
			tmatrix = {e:0, f:0};
		else {
            if(window.WebKitCSSMatrix)
                tmatrix = new WebKitCSSMatrix(matrix);
            else if (window.MSCSSMatrix)
            	tmatrix = new MSCSSMatrix(matrix);
			else {
	            // matrix(1, 0, 0, 1, 0, 0) --> 1, 0, 0, 1, 0, 0
	            var _tmatrix = matrix.replace(/(matrix\()(.*)(\))/gi, "$2");
	            // 1, 0, 0, 1, 0, 0 --> 1,0,0,1,0,0
	            _tmatrix = _tmatrix.replace(/\s/gi, "");
	            _tmatrix = _tmatrix.split(',');

	            var tmatrix = {};
	            var tkey = ['a', 'b', 'c', 'd', 'e', 'f'];
	            for(var i=0; i<tkey.length; i++){
	                tmatrix[tkey[i]] = parseInt(_tmatrix[i], 10);
	            }
	        }
        }

        if (t._scroll_master)
        	t._scroll_master._sync_pos(tmatrix);

        return tmatrix;
	},	
	_correct_minmax:function(value, allow, current, dx, px){
		if (value === current) return value;
		
		var delta = Math.abs(value-current);
		var sign = delta/(value-current);
	//	t._fast_correction = true;
		
		
		if (value>0) return allow?(current + sign*Math.sqrt(delta)):0;
		
		var max = dx - px;
		if (max + value < 0)	
			return allow?(current - Math.sqrt(-(value-current))):-max;
			
	//	t._fast_correction = false;
		return value;
	},	
	_init_scroll_node:function(node){
		if (!node.scroll_enabled){ 
			node.scroll_enabled = true;	
			node.parentNode.style.position="relative";
			var prefix = smdui.env.cssPrefix;
			node.style.cssText += prefix+"transition: "+prefix+"transform; "+prefix+"user-select:none; "+prefix+"transform-style:flat;";
			node.addEventListener(smdui.env.transitionEnd,t._scroll_end,false);
		}
	},
	_init_scroller:function(delta){
		if (t._scroll_mode.indexOf("x") != -1)
			t._scroll[0] = t._create_scroll("x", t._scroll_stat.dx, t._scroll_stat.px, "width");
		if (t._scroll_mode.indexOf("y") != -1)
			t._scroll[1] = t._create_scroll("y", t._scroll_stat.dy, t._scroll_stat.py, "height");
			
		t._init_scroll_node(t._scroll_node);
		window.setTimeout(t._set_scroll_pos,1);
	},
	_create_scroll:function(mode, dy, py, dim){
		if (dy - py <2){
			var matrix = t._get_matrix(t._scroll_node);
			var e = (mode=="y"?matrix.e:0);
			var f = (mode=="y"?0:matrix.f);
			if (!t._scroll_master)
				t._set_matrix(t._scroll_node, e, f, "0ms");
			t._scroll_mode = t._scroll_mode.replace(mode,"");
			return "";
		}

		var scroll = smdui.html.create("DIV", {
			"class":"smdui_scroll_"+mode
		},"");

		scroll.style[dim] = Math.max((py*py/dy-7),10) +"px";
		if (t._scroll_stat.left) 
			if (mode === "x")
				scroll.style.left = t._scroll_stat.left+"px";
			else
				scroll.style.right = (-t._scroll_stat.left)+"px";
		if (t._scroll_stat.hidden)
			scroll.style.visibility = "hidden";

		t._scroll_node.parentNode.appendChild(scroll);
		
		return scroll;
	},
	_axis_check:function(value, mode, old){
		if (value > t.config.deltaStep){
				if (t._was_not_moved){
					t._long_move(mode);
					t._locate(mode);
					if ((t._scroll_mode||"").indexOf(mode) == -1) t._scroll_mode = "";
				}
				return false;
		}
		return old;
	},
	_scroll_end:function(){
        //sending event to the owner of the scroll only
        var result,state,view;
        view = smdui.$$(t._scroll_node||this);
        if (view){
        	if (t._scroll_node)
        		result = t._get_matrix(t._scroll_node);
        	else if(view.getScrollState){
                state = view.getScrollState();
                result = {e:state.x, f:state.y};
            }
            smdui.callEvent("onAfterScroll", [result]);
            if (view.callEvent)
                 view.callEvent("onAfterScroll",[result]);
        }
		if (!t._scroll_mode){
			smdui.html.remove(t._scroll);
			t._scroll = [null, null];
		}
		t._active_transion = false;
	},
	_long_move:function(mode){
		window.clearTimeout(t._long_touch_timer);
		t._was_not_moved = false;	
	},	
	_stop_old_scroll:function(e){
		if (t._scroll[0] || t._scroll[1]){
			t._stop_scroll(e, t._scroll[0]?"x":"y");
		}else
			return true;
	},
	_touchstart :function(e){
		var target = e.target || event.srcElement;


		if (t._disabled || (target.tagName&&target.tagName.toLowerCase() == "textarea" && target.offsetHeight<target.scrollHeight)) return;
		t._long_touched = null;
		t._scroll_context = t._start_context = mouse.context(e);

		// in "limited" mode we should have possibility to use slider
		var element = smdui.$$(e);

		if (t._limited && !t._is_scroll() && !(element && element.$touchCapture)){
			t._scroll_context = null;
		}



		t._translate_event("onTouchStart");

		if (t._stop_old_scroll(e))
			t._long_touch_timer = window.setTimeout(t._long_touch, t.config.longTouchDelay);
		
		if (element && element.touchable && (!target.className || target.className.indexOf("smdui_view")!==0)){
			t._css_button_remove = element.getNode(e);
			smdui.html.addCss(t._css_button_remove,"smdui_touch");
		}	
			
	},
	_long_touch:function(e){
        if(t._start_context){
			t._translate_event("onLongTouch");
			smdui.callEvent("onClick", [t._start_context]);
			t._long_touched = true;
			//t._clear_artefacts();
        }
	},
	_stop_scroll:function(e, stop_mode){ 
		t._locate(stop_mode);
		var scroll = t._scroll[0]||t._scroll[1];
		if (scroll){
			var view = t._get_event_view("onBeforeScroll", true);
			if (view)
				view.callEvent("onBeforeScroll", [t._start_context,t._current_context]);
		}
		if (scroll && (!t._scroll_node || scroll.parentNode != t._scroll_node.parentNode)){
			t._clear_artefacts();
			t._scroll_end();
			t._start_context = mouse.context(e);
		}
		t._touchmove(e);
	},	
	_get_delta:function(e, ch){
		t._prev_context = t._current_context;
		t._current_context = mouse.context(e);
			
		t._delta._x = Math.abs(t._start_context.x - t._current_context.x);
		t._delta._y = Math.abs(t._start_context.y - t._current_context.y);
		
		if (t._prev_context){
			if (t._current_context.time - t._prev_context.time < t.config.scrollDelay){
				t._delta._x_moment = t._delta._x_moment/1.3+t._current_context.x - t._prev_context.x;
				t._delta._y_moment = t._delta._y_moment/1.3+t._current_context.y - t._prev_context.y;
			}
			else {
				t._delta._y_moment = t._delta._x_moment = 0;
			}
			t._delta._time = t._delta._time/1.3+(t._current_context.time - t._prev_context.time);
		}
		
		return t._delta;
	},
	_get_sizes:function(node){
		t._scroll_stat = {
			dx:node.offsetWidth,
			dy:node.offsetHeight,
			px:node.parentNode.offsetWidth,
			py:node.parentNode.offsetHeight
		};
	},
	_is_scroll:function(locate_mode){
		var node = t._start_context.target;
		if (!smdui.env.touch && !smdui.env.transition && !smdui.env.transform) return null;
		while(node && node.tagName!="BODY"){
			if(node.getAttribute){
				var mode = node.getAttribute("touch_scroll");
				if (mode && (!locate_mode || mode.indexOf(locate_mode)!=-1))
					return [node, mode];
			}
			node = node.parentNode;
		}
		return null;
	},
	_locate:function(locate_mode){
		var state = this._is_scroll(locate_mode);
		if (state){
			t._scroll_mode = state[1];
			t._scroll_node = state[0];
			t._get_sizes(state[0]);
		}
		return state;
	},
	_translate_event:function(name){
		smdui.callEvent(name, [t._start_context,t._current_context]);
		var view = t._get_event_view(name);
		if (view)
			view.callEvent(name, [t._start_context,t._current_context]);
	},
	_get_event_view:function(name, active){
		var view = smdui.$$(active ? t._scroll_node : t._start_context);
		if(!view) return null;
		
		while (view){
			if (view.hasEvent&&view.hasEvent(name))	
				return view;
			view = view.getParentView();
		}
		
		return null;
	},	
	_get_context:function(e){
		if (!e.touches[0]) {
			var temp = t._current_context;
			temp.time = new Date();
			return temp;
		}
			
		return {
			target:e.target,
			x:e.touches[0].pageX,
			y:e.touches[0].pageY,
			time:new Date()
		};
	},
	_get_context_m:function(e){
		return {
			target:e.target || e.srcElement,
			x:e.pageX,
			y:e.pageY,
			time:new Date()
		};
	}
};


function touchInit(){
	if (smdui.env.touch){
		t.$init();
		//not full screen mode
		if (document.body.className.indexOf("smdui_full_screen") == -1)
			t.limit(true);

		if (window.MSCSSMatrix)
			smdui.html.addStyle(".smdui_view{ -ms-touch-action: none; }");
	} else {
		var id = smdui.event(document.body, "touchstart", function(ev){
			if (ev.touches.length && ev.touches[0].radiusX > 4){
				smdui.env.touch = true;
				setMouse(mouse);
				touchInit();
				for (var key in smdui.ui.views){
					var view = smdui.ui.views[key];
					if (view && view.$touch)
						view.$touch();
				}
			}
			smdui.eventRemove(id);
		}, { capture: true });
	}
}

function setMouse(mouse){
	mouse.down = "touchstart";
	mouse.move = "touchmove";
	mouse.up   = "touchend";
	mouse.context = t._get_context;
}

smdui.ready(touchInit);


var mouse = smdui.env.mouse = { down:"mousedown", up:"mouseup", 
								move:"mousemove", context:t._get_context_m };

if (window.navigator.pointerEnabled){
	mouse.down = "pointerdown";
	mouse.move = "pointermove";
	mouse.up   = "pointerup";
} else if (window.navigator.msPointerEnabled){
	mouse.down = "MSPointerDown";
	mouse.move = "MSPointerMove";
	mouse.up   = "MSPointerUp";
} else if (smdui.env.touch)
	setMouse(mouse);

})();


smdui.editors.$popup.multiselect = {
	view:"multisuggest",
	suggest:{
		button:true
	}
};

smdui.Canvas = smdui.proto({
	$init:function(container){
		this._canvas_labels = [];
		this._canvas_series =  (!smdui.isUndefined(container.series)?container.series:container.name);
		this._obj = smdui.toNode(container.container||container);
		var width = container.width*(window.devicePixelRatio||1);
		var height = container.height*(window.devicePixelRatio||1);
		var style = container.style||"";
		style += ";width:"+container.width+"px;height:"+container.height+"px;";
		this._prepareCanvas(container.name, style ,width, height);
	},
	_prepareCanvas:function(name,style,x,y){
		//canvas has the same size as master object
		this._canvas = smdui.html.create("canvas",{ title:name, width:x, height:y, canvas_id:name, style:(style||"")});
		this._obj.appendChild(this._canvas);
		//use excanvas in IE
		if (!this._canvas.getContext){
			if (smdui.env.isIE){
				smdui.require("legacy/excanvas/excanvas.js", true);	//sync loading
				G_vmlCanvasManager.init_(document);
				G_vmlCanvasManager.initElement(this._canvas);
			} else	//some other not supported browser
				smdui.assert(this._canvas.getContext,"Canvas is not supported in the browser");
		}
		return this._canvas;
	}, 
	getCanvas:function(context){
		var ctx = (this._canvas||this._prepareCanvas(this._contentobj)).getContext(context||"2d");
		if(!this._smduiDevicePixelRatio){
			this._smduiDevicePixelRatio = true;
			ctx.scale(window.devicePixelRatio||1, window.devicePixelRatio||1);
		}
		return ctx;
	},
	_resizeCanvas:function(x, y){
		if (this._canvas){
			this._canvas.setAttribute("width", x*(window.devicePixelRatio||1));
			this._canvas.setAttribute("height", y*(window.devicePixelRatio||1));
			this._canvas.style.width = x+"px";
			this._canvas.style.height = y+"px";
			this._smduiDevicePixelRatio = false;
		}
	},
	renderText:function(x,y,text,css,w){
		if (!text) return; //ignore empty text
		if (w) w = Math.max(w,0);
		if (y) y = Math.max(y,0);
		var t = smdui.html.create("DIV",{
			"class":"smdui_canvas_text"+(css?(" "+css):""),
			"style":"left:"+x+"px; top:"+y+"px;",
			"aria-hidden":"true"
		},text);
		this._obj.appendChild(t);
		this._canvas_labels.push(t); //destructor?
		if (w)
			t.style.width = w+"px";
		return t;
	},
	renderTextAt:function(valign,align, x,y,t,c,w){
		var text=this.renderText.call(this,x,y,t,c,w);
		if (text){
			if (valign){
				if(valign == "middle")
					text.style.top = parseInt(y-text.offsetHeight/2,10) + "px";
				else
					text.style.top = y-text.offsetHeight + "px";
			}
			if (align){
				if(align == "left")
					text.style.left = x-text.offsetWidth + "px";
				else
					text.style.left = parseInt(x-text.offsetWidth/2,10) + "px";
			}
		}
		return text;
	},
	clearCanvas:function(skipMap){
		var areas=[], i;

		smdui.html.remove(this._canvas_labels);
		this._canvas_labels = [];

		if (!skipMap&&this._obj._htmlmap){

			//areas that correspond this canvas layer
			areas = this._getMapAreas();
			//removes areas of this canvas
			while(areas.length){
				areas[0].parentNode.removeChild(areas[0]);
				areas.splice(0,1);
			}
			areas = null;

			//removes _htmlmap object if all its child nodes are removed
			if(!this._obj._htmlmap.getElementsByTagName("AREA").length){
				this._obj._htmlmap.parentNode.removeChild(this._obj._htmlmap);
				this._obj._htmlmap = null;
			}

		}
		//FF breaks, when we are using clear canvas and call clearRect without parameters
		this.getCanvas().clearRect(0,0,this._canvas.offsetWidth, this._canvas.offsetHeight);
	},
	toggleCanvas:function(){
		this._toggleCanvas(this._canvas.style.display=="none");
	},
	showCanvas:function(){
		this._toggleCanvas(true);
	},
	hideCanvas:function(){
		this._toggleCanvas(false);
	},
	_toggleCanvas:function(show){
		var areas, i;

		for(i=0; i < this._canvas_labels.length;i++)
			this._canvas_labels[i].style.display = (show?"":"none");

		if (this._obj._htmlmap){
			areas = this._getMapAreas();
			for( i = 0; i < areas.length; i++){
				if(show)
					areas[i].removeAttribute("disabled");
				else
					areas[i].setAttribute("disabled","true");
			}
		}
		//FF breaks, when we are using clear canvas and call clearRect without parameters
		this._canvas.style.display = (show?"":"none");
	},
	_getMapAreas:function(){
		var res = [], areas, i;
		areas = this._obj._htmlmap.getElementsByTagName("AREA");
		for(i = 0; i < areas.length; i++){
			if(areas[i].getAttribute("userdata") == this._canvas_series){
				res.push(areas[i]);
			}
		}

		return res;
	}
});

smdui.color = {
	_toHex:["0","1","2","3","4","5","6","7","8","9","A","B","C","D","E","F"],
	toHex:function(number, length){
		number=parseInt(number,10);
		var str = "";
			while (number>0){
				str=this._toHex[number%16]+str;
				number=Math.floor(number/16);
			}
			while (str.length <length)
				str = "0"+str;
		return str;
	},
	hexToDec:function(hex){
		return parseInt(hex, 16);
	},
	toRgb:function(rgb){
		var r,g,b,rgbArr;
		if (typeof(rgb) != 'string') {
			r = rgb[0];
			g = rgb[1];
			b = rgb[2];
		} else if (rgb.indexOf('rgb')!=-1) {
			rgbArr = rgb.substr(rgb.indexOf("(")+1,rgb.lastIndexOf(")")-rgb.indexOf("(")-1).split(",");
			r = rgbArr[0];
			g = rgbArr[1];
			b = rgbArr[2];
		} else {
			if (rgb.substr(0, 1) == '#') {
				rgb = rgb.substr(1);
			}
			r = this.hexToDec(rgb.substr(0, 2));
			g = this.hexToDec(rgb.substr(2, 2));
			b = this.hexToDec(rgb.substr(4, 2));
		}
		r = (parseInt(r,10)||0);
		g = (parseInt(g,10)||0);
		b = (parseInt(b,10)||0);
		if (r < 0 || r > 255)
			r = 0;
		if (g < 0 || g > 255)
			g = 0;
		if (b < 0 || b > 255)
			b = 0;
		return [r,g,b];
	},
	hsvToRgb:function(h, s, v){
		var hi,f,p,q,t,r,g,b;
		hi = Math.floor((h/60))%6;
		f = h/60-hi;
		p = v*(1-s);
		q = v*(1-f*s);
		t = v*(1-(1-f)*s);
		r = 0;
		g = 0;
		b = 0;
		switch(hi) {
			case 0:
				r = v; g = t; b = p;
				break;
			case 1:
				r = q; g = v; b = p;
				break;
			case 2:
				r = p; g = v; b = t;
				 break;
			case 3:
				r = p; g = q; b = v;
				break;
			case 4:
				r = t; g = p; b = v;
				break;
			case 5:
				r = v; g = p; b = q;
				break;
			default:
				break;
		}
		r = Math.floor(r*255);
		g = Math.floor(g*255);
		b = Math.floor(b*255);
		return [r, g, b];
	},
	rgbToHsv:function(r, g, b){
		var r0,g0,b0,min0,max0,s,h,v;
		r0 = r/255;
		g0 = g/255;
		b0 = b/255;
		min0 = Math.min(r0, g0, b0);
		max0 = Math.max(r0, g0, b0);
		h = 0;
		s = max0===0?0:(1-min0/max0);
		v = max0;
		if (max0 == min0) {
			h = 0;
		} else if (max0 == r0 && g0>=b0) {
			h = 60*(g0 - b0)/(max0 - min0)+0;
		} else if (max0 == r0 && g0 < b0) {
			h = 60*(g0 - b0)/(max0 - min0)+360;
		} else if (max0 == g0) {
			h = 60*(b0 - r0)/(max0-min0)+120;
		} else if (max0 == b0) {
			h = 60*(r0 - g0)/(max0 - min0)+240;
		}
		return [h, s, v];
	}
};

smdui.HtmlMap = smdui.proto({
	$init:function(key){
		this._id = "map_"+smdui.uid();
		this._key = key;
		this._map = [];
		this._areas = [];
	},
	addRect: function(id,points,userdata) {
		this._createMapArea(id,"RECT",points,userdata);
	},
	addPoly: function(id,points,userdata) {
		this._createMapArea(id,"POLY",points,userdata);
	},
	_createMapArea:function(id,shape,coords,userdata){
		var extra_data = "";
		if(arguments.length==4) 
			extra_data = "userdata='"+userdata+"'";
		this._map.push("<area "+this._key+"='"+id+"' shape='"+shape+"' coords='"+coords.join()+"' "+extra_data+"></area>");
		this._areas.push({index: userdata, points:coords});

	},
	addSector:function(id,alpha0,alpha1,x,y,R,ky,userdata){
		var points = [];
		points.push(x);
		points.push(Math.floor(y*ky)); 
		for(var i = alpha0; i < alpha1; i+=Math.PI/18){
			points.push(Math.floor(x+R*Math.cos(i)));
			points.push(Math.floor((y+R*Math.sin(i))*ky));
		}
		points.push(Math.floor(x+R*Math.cos(alpha1)));
		points.push(Math.floor((y+R*Math.sin(alpha1))*ky));
		points.push(x);
		points.push(Math.floor(y*ky)); 
		
		return this.addPoly(id,points,userdata);
	},
	hide:function(obj, data, mode){
		if (obj.querySelectorAll){
			var nodes = obj.querySelectorAll("area[userdata=\""+data+"\"]");
			for (var i = 0; i < nodes.length; i++)
				nodes[i].style.display = mode?"none":"";
		}
	},
	render:function(obj){
		var d = smdui.html.create("DIV");
		d.style.cssText="position:absolute; width:100%; height:100%; top:0px; left:0px;";
		obj.appendChild(d);
		var src = smdui.env.isIE?"":"src='data:image/gif;base64,R0lGODlhEgASAIAAAP///////yH5BAUUAAEALAAAAAASABIAAAIPjI+py+0Po5y02ouz3pwXADs='";
		d.innerHTML="<map id='"+this._id+"' name='"+this._id+"'>"+this._map.join("\n")+"</map><img "+src+" class='smdui_map_img' usemap='#"+this._id+"'>";
		
		obj._htmlmap = d; //for clearing routine
		
		this._map = [];
	}
});	

/*
	UI:Calendar
*/
smdui.protoUI({
	name:"calendar",

	defaults:{
		date: new Date(), //selected date, not selected by default
		select: false,
		navigation: true,
		monthSelect: true,
		weekHeader: true,
		weekNumber: false,
		skipEmptyWeeks: false,

		calendarHeader: "%F %Y",
		calendarWeekHeader: "W#",
		//calendarTime: "%H:%i",
		events:smdui.Date.isHoliday,
		minuteStep: 5,
		icons: false,
		timepickerHeight: 30,
		headerHeight: 70,
		dayTemplate: function(d){
			return d.getDate();
		},
		width: 260,
		height: 250
	},

	dayTemplate_setter: smdui.template,
	calendarHeader_setter:smdui.Date.dateToStr,
	calendarWeekHeader_setter:smdui.Date.dateToStr,
	calendarTime_setter:function(format){
		this._calendarTime = format;
		return smdui.Date.dateToStr(format);
	},
	date_setter:function(date){
		return this._string_to_date(date);
	},
	maxDate_setter:function(date){
		return this._string_to_date(date);
	},
	minDate_setter:function(date){
		return this._string_to_date(date);
	},
	minTime_setter:function(time){
		if(typeof(time) == "string"){
			time = smdui.i18n.parseTimeFormatDate(time);
			time = [time.getHours(),time.getMinutes()];

		}

		return time;
	},
	maxTime_setter:function(time){
		if(typeof(time) == "string"){
			time = smdui.i18n.parseTimeFormatDate(time);
			time = [time.getHours(),time.getMinutes()];
		}
		return time;
	},
	_ariaFocus:function(){
		var ev = "focus"+(smdui.env.isIE?"in":"");

		smdui._event(this.$view, ev, smdui.bind(function(e){
			var t = e.target.className;
			var css = t.indexOf("smdui_cal_day")!==-1 ? "smdui_cal_day" : (t.indexOf("smdui_cal_block")!==-1?"smdui_cal_block":"");

			if(new Date() - smdui.UIManager._tab_time > 300 && css){
				var prev = e.relatedTarget;
				if(prev && !smdui.isUndefined(prev.className)){
					var date = (css=="smdui_cal_day")?
						this._locate_day(e.target):
						this._locate_date(e.target);
					this._moveSelection(date, false);
				}
			}
		}, this), {capture:!smdui.env.isIE});
	},
	$init: function() {
		this._viewobj.className += " smdui_calendar";
		this._viewobj.setAttribute("role", "region");
		this._viewobj.setAttribute("aria-label", smdui.i18n.aria.calendar);

		//special dates
		this._special_dates = {};
		this._selected_date_part = this._selected_date = null;
		this._zoom_level = 0;

		//navigation and aria
		this._ariaFocus();
		this.attachEvent("onKeyPress", this._onKeyPress);
		this.attachEvent("onAfterZoom", function(zoom){
			if(zoom >= 0) this.$view.querySelector(".smdui_cal_month_name").blur();
		});
	},
	type_setter: function(value){
		if(value == "time"){
			this._zoom_in = true;
			this._zoom_level = -1;
		}
		else if(value == "year"){
			this._fixed = true;
		}
		return value;
	},
	$setSize:function(x,y){

		if(smdui.ui.view.prototype.$setSize.call(this,x,y)){
			//repaint calendar when size changed
			this.render();
		}
	},
	$getSize:function(dx, dy){
		if (this._settings.cellHeight){
			var state = this._getDateBoundaries(this._settings.date);
			this._settings.height = this._settings.cellHeight * state._rows + (smdui.skin.$active.calendarHeight||70);
		}
		return smdui.ui.view.prototype.$getSize.call(this, dx,dy);
	},
	moveSelection:function(mode){
		if(this.config.master) return; //in daterange

		var date = smdui.Date.copy(this.getSelectedDate() || this.getVisibleDate());
		this._moveSelection(date, mode);
		
	},
	_moveSelection:function(date, mode){
		var css = this._zoom_logic[this._zoom_level]._keyshift(date, mode, this);

		var sel = this._viewobj.querySelector("."+css+"[tabindex='0']");
		if(sel) sel.focus();
	},
	_getDateBoundaries: function(date, reset) {
		// addition information about rendering event:
		// how many days from the previous month,
		// next,
		// number of weeks to display and so on
		
		if (!this._set_date_bounds || reset){
			var month = date.getMonth();
			var year = date.getFullYear();

			var next = new Date(year, month+1, 1);
			var start = smdui.Date.weekStart(new Date(year, month, 1));

			var days = Math.round((next.valueOf() - start.valueOf())/(60*1000*60*24));
			var rows = this._settings.skipEmptyWeeks?Math.ceil(days/7):6;

			this._set_date_bounds = { _month: month, _start:start, _next:next, _rows: rows};
		}

		return this._set_date_bounds;
	},
	$skin:function(){
		if(smdui.skin.$active.calendar){
			if( smdui.skin.$active.calendar.width)
				this.defaults.width = smdui.skin.$active.calendar.width;
			if( smdui.skin.$active.calendar.height)
				this.defaults.height = smdui.skin.$active.calendar.height;
			if( smdui.skin.$active.calendar.headerHeight)
				this.defaults.headerHeight = smdui.skin.$active.calendar.headerHeight;
			if( smdui.skin.$active.calendar.timepickerHeight)
				this.defaults.timepickerHeight = smdui.skin.$active.calendar.timepickerHeight;
		}

	},
	_getColumnConfigSizes: function(date){ 
		var bounds = this._getDateBoundaries(date);

		var s = this._settings;
		var _columnsHeight = [];
		var _columnsWidth = [];

		var containerWidth = this._content_width - 36;

		var containerHeight = this._content_height - this._settings.headerHeight - 10 - (this._settings.timepicker||this._icons?this._settings.timepickerHeight:0);

		var columnsNumber = (s.weekNumber)?8:7;
		for(var i=0; i<columnsNumber; i++) {
			_columnsWidth[i] = Math.ceil(containerWidth/(columnsNumber-i));
			containerWidth -= _columnsWidth[i];
		}

		var rowsNumber = bounds._rows;
		for (var k = 0; k < rowsNumber; k++) {
			_columnsHeight[k] = Math.ceil(containerHeight/(rowsNumber-k) );
			containerHeight -= _columnsHeight[k];
		}
		return [_columnsWidth, _columnsHeight];
	},
	icons_setter: function(value){
		if(!value)
			this._icons = null;
		else if(typeof value == "object")
			this._icons = value;
		else
			this._icons = this._icons2;
	},
	_icons: [],
	_icons2: [

		{
			template: function(){
				return "<span role='button' tabindex='0' class='smdui_cal_icon_today smdui_cal_icon'>"+smdui.i18n.calendar.today+"</span>";
			},
			on_click:{
				"smdui_cal_icon_today": function(){
					this.setValue(new Date());
					this.callEvent("onTodaySet",[this.getSelectedDate()]);
				}
			}
		},
		{
			template: function(){
				return "<span role='button' tabindex='0' class='smdui_cal_icon_clear smdui_cal_icon'>"+smdui.i18n.calendar.clear+"</span>";
			},
			on_click:{
				"smdui_cal_icon_clear": function(){
					this.setValue("");
					this.callEvent("onDateClear",[this.getSelectedDate()]);
				}
			}
		}
	],
	refresh:function(){ this.render(); },
	render: function() {
		//reset zoom level
		this._zoom_level = 0;
		this._zoom_size = false;

		var s = this._settings;

		if (!this.isVisible(s.id)) return;
		this._current_time = smdui.Date.datePart(new Date());

		if (smdui.debug_render)
			smdui.log("Render: "+this.name+"@"+s.id);
		this.callEvent("onBeforeRender",[]);

		var date = this._settings.date;

		var bounds = this._getDateBoundaries(date, true);
		var sizes = this._getColumnConfigSizes(date);
		var width = sizes[0];
		var height = sizes[1];

		var html = "<div class='smdui_cal_month'><span role='button' tabindex='0' aria-live='assertive' aria-atomic='true' class='smdui_cal_month_name"+(!this._settings.monthSelect?" smdui_readonly":"")+"'>"+s.calendarHeader(date)+'</span>';
		if (s.navigation)
			html += "<div role='button' tabindex='0' aria-label='"+smdui.i18n.aria.navMonth[0]+"' class='smdui_cal_prev_button'></div><div role='button' tabindex='0' aria-label='"+smdui.i18n.aria.navMonth[1]+"' class='smdui_cal_next_button'></div>";
		html += "</div>";

		if(s.weekHeader)
			html += "<div class='smdui_cal_header' aria-hidden='true'>"+this._week_template(width)+"</div>";
		html += "<div class='smdui_cal_body'>"+this._body_template(width, height, bounds)+"</div>";

		if (this._settings.timepicker || this._icons){
			html += "<div class='smdui_cal_footer'>";
			if(this._settings.timepicker)
				html += this._timepicker_template(date);

			if(this._icons)
				html += this._icons_template();
			html += "</div>";
		}

		this._contentobj.innerHTML = html;

		if(this._settings.type == "time"){
			var time = this._settings.date;
			if(time){
				if(typeof(time) == "string"){
					date = smdui.i18n.parseTimeFormatDate(time);
				}
				else if(smdui.isArray(time)){
					date.setHours(time[0]);
					date.setMinutes(time[1]);
				}
			}
			this._changeZoomLevel(-1,date);
		}
		else if(this._settings.type == "month"){
			this._changeZoomLevel(1,date);
		}
		else if(this._settings.type == "year"){
			this._changeZoomLevel(2,date);
		}

		this.callEvent("onAfterRender",[]);
	},
	_icons_template: function(date){
		var html =	"<div class='smdui_cal_icons'>";
		var icons = this._icons;

		for(var i=0; i < icons.length; i++){
			if(icons[i].template){
				var template = (typeof(icons[i].template) == "function"?icons[i].template: smdui.template(icons[i].template));
				html += template.call(this,date);
			}
			if(icons[i].on_click){
				smdui.extend(this.on_click,icons[i].on_click);
			}
		}
		html += "</div>";
		return html;
	},
	_timepicker_template:function(date){
		var timeFormat = this._settings.calendarTime||smdui.i18n.timeFormatStr;
		var tpl = "";

		if(!this._settings.master)
			tpl = "<div role='button' tabindex='0' class='smdui_cal_time"+(this._icons?" smdui_cal_time_icons":"")+"'><span class='smdui_icon fa-clock-o'></span> "+timeFormat(date)+"</div>";
		else{
			//daterange needs two clocks
			var range_date = smdui.copy(smdui.$$(this._settings.master)._settings.value);
			if(smdui.Date.equal(range_date.end, date))
				range_date.start = range_date.end;
				
			for(var i in range_date){
				tpl += "<div role='button' tabindex='0' class='smdui_range_time_"+i+" smdui_cal_time'><span class='smdui_icon fa-clock-o'></span> "+timeFormat(range_date[i])+"</div>";
			}
		}
		return tpl;
	},
	_week_template: function(widths){
		var s = this._settings;
		var week_template = '';
		var correction = 0;

		if(s.weekNumber) {
			correction = 1;
			week_template += "<div class='smdui_cal_week_header' style='width: "+widths[0]+"px;' >"+s.calendarWeekHeader()+"</div>";
		}
		
		var k = (smdui.Date.startOnMonday)?1:0;
		for (var i=0; i<7; i++){ // 7 days total
			var day_index = (k + i) % 7; // 0 - Sun, 6 - Sat as in Locale.date.day_short
			var day = smdui.i18n.calendar.dayShort[day_index]; // 01, 02 .. 31
			week_template += "<div day='"+day_index+"' style='width: "+widths[i+correction]+"px;' >"+day+"</div>";
		}
		
		return week_template;
	},
    blockDates_setter:function(value){
        return smdui.toFunctor(value, this.$scope);
    },
    _day_css:function(day, bounds){
		var css = "";
		if (smdui.Date.equal(day, this._current_time))
			css += " smdui_cal_today";
		if (!this._checkDate(day))
			css+= " smdui_cal_day_disabled";
		if (smdui.Date.equal(day, this._selected_date_part))
			css += " smdui_cal_select";
		if (day.getMonth() != bounds._month)
			css += " smdui_cal_outside";
		if (this._settings.events)
			css+=" "+(this._settings.events(day) || "");
		css += " smdui_cal_day";
		return css;
	},
	_body_template: function(widths, heights, bounds){
		var s = this._settings;
		var html = "";
		var day = smdui.Date.datePart(smdui.Date.copy(bounds._start));
		var start = s.weekNumber?1:0;
		var weekNumber = smdui.Date.getISOWeek(smdui.Date.add(day,2,"day", true));
		var min = this._settings.minDate || new Date(1,1,1);
        var max = this._settings.maxDate || new Date(9999,1,1);

		for (var y=0; y<heights.length; y++){
			html += "<div class='smdui_cal_row' style='height:"+heights[y]+"px;line-height:"+heights[y]+"px'>";

			if (start){
				// recalculate week number for the first week of a year
				if(!day.getMonth() && day.getDate()<7)
					weekNumber =  smdui.Date.getISOWeek(smdui.Date.add(day,2,"day", true));
				html += "<div class='smdui_cal_week_num' aria-hidden='true' style='width:"+widths[0]+"px'>"+weekNumber+"</div>";
			}

			for (var x=start; x<widths.length; x++){
				var css = this._day_css(day, bounds);
				var d = this._settings.dayTemplate.call(this,day);
				var sel = smdui.Date.equal(day, this._selected_date_part);
				var alabel = "";

				if(typeof d == "object"){
					alabel = d.aria || alabel;
					d = d.text;
				}
				else
					alabel = smdui.Date.dateToStr(smdui.i18n.aria.dateFormat)(day);

				html += "<div day='"+x+"' role='gridcell' "+(day.getMonth() != bounds._month?"aria-hidden='true'":"")+" aria-label='"+alabel+
					"' tabindex='"+(sel?"0":"-1")+"' aria-selected='"+(sel?"true":"false")+
					"' class='"+css+"' style='width:"+widths[x]+"px'><span aria-hidden='true' class='smdui_cal_day_inner'>"+d+"</span></div>";
				day = smdui.Date.add(day, 1, "day");
				if(day.getHours()){
					day = smdui.Date.datePart(day);
				}
			}

			html += "</div>";
			weekNumber++;
		}
		return html;
	},
	_changeDate:function(dir, step, notset){
		var now = this._settings.date;
		if(!step) { step = this._zoom_logic[this._zoom_level]._changeStep; }
		if(!this._zoom_level){
			now = smdui.Date.copy(now);
			now.setDate(1);
		}
		var next = smdui.Date.add(now, dir*step, "month", true);
		this._changeDateInternal(now, next);
	},
	_changeDateInternal:function(now, next){
		if(this.callEvent("onBeforeMonthChange", [now, next])){
			if (this._zoom_level){
				this._update_zoom_level(next);
			}
			else{
				this.showCalendar(next);
			}
			this.callEvent("onAfterMonthChange", [next, now]);
		}
	},
	_zoom_logic:{
		"-2":{
			_isBlocked: function(i){
				var config = this._settings,
					date = config.date,
					isBlocked = false;

				var minHour = (config.minTime ? config.minTime[0] : 0);
				var maxHour = (config.maxTime ? (config.maxTime[0] + ( config.maxTime[1] ? 1 : 0 )) : 24);

				var minMinute = (config.minTime && (date.getHours()==minHour) ? config.minTime[1] : 0);
				var maxMinute = (config.maxTime && config.maxTime[1] && (date.getHours()==(maxHour-1)) ? config.maxTime[1] : 60);

				if(this._settings.blockTime){
					var d = smdui.Date.copy(date);
					d.setMinutes(i);
					isBlocked = this._settings.blockTime(d);
				}
				return (i < minMinute || i >= maxMinute || isBlocked);

			},
			_setContent:function(next, i){ next.setMinutes(i); },
			_findActive:function(date, mode, calendar){
				if(!this._isBlocked.call(calendar, date.getMinutes()))
					return date;
				else{
					var step = calendar._settings.minuteStep;
					var newdate = smdui.Date.add(date, mode =="right"?step:-step, "minute", true);
					if(date.getHours() === newdate.getHours())
						return  this._findActive(newdate, mode, calendar);
				}
			}
		},
		"-1":{
			_isBlocked: function(i){
				var config = this._settings,
					date = config.date;

				var minHour = (config.minTime? config.minTime[0]:0);
				var maxHour = (config.maxTime? config.maxTime[0]+(config.maxTime[1]?1:0):24);

				if (i < minHour || i >= maxHour) return true;

				if(config.blockTime){
					var d = smdui.Date.copy(date);
					d.setHours(i);
					
					var minMinute = (config.minTime && (i==minHour) ? config.minTime[1] : 0);
					var maxMinute = (config.maxTime && config.maxTime[1] && (i==(maxHour-1)) ? config.maxTime[1] : 60);

					for (var j=minMinute; j<maxMinute; j+= config.minuteStep){
						d.setMinutes(j);
						if (!config.blockTime(d))
							return false;
					}
					return true;
				}
			},
			_setContent:function(next, i){ next.setHours(i); },
			_keyshift:function(date, mode, calendar){
				var newdate, inc, step = calendar._settings.minuteStep;
				
				if(mode === "bottom" || mode === "top"){
					date.setHours(mode==="bottom"?23:0);
					date.setMinutes(mode==="bottom"?55:0);
					date.setSeconds(0);
					date.setMilliseconds(0);
					newdate = date;
				}
				else if(mode === "left" || mode === "right"){//minutes

					inc = (mode==="right"?step:-step);
					if(mode === "left" && date.getMinutes() < step ) inc = 60-step;
					if(mode === "right" && date.getMinutes() >= (60-step)) inc = step-60;
					inc -= date.getMinutes()%step;
					newdate = calendar._zoom_logic["-2"]._findActive(smdui.Date.add(date, inc, "minute"), mode, calendar);
				}
				else if(mode === "up" || mode === "down"){ //hours
					inc = mode==="down"?1:-1;
					if(mode === "down" && date.getHours() === 23) inc = -23;
					if(mode === "up" && date.getHours() === 0) inc = 23;
					newdate = this._findActive(smdui.Date.add(date, inc, "hour"), mode, calendar);
				}
				else if(mode === false)
					newdate = this._findActive(date, mode, calendar);

				calendar.selectDate(newdate, false);

				if(newdate){
					calendar._update_zoom_level(newdate);
					calendar.selectDate(newdate, false);
				}

				return "smdui_cal_block"+(mode === "left" || mode === "right"?"_min":"");
			},
			_findActive:function(date, mode, calendar){
				if(!this._isBlocked.call(calendar, date.getHours()))
					return date;
				else{
					var newdate = smdui.Date.add(date, mode =="down"?1:-1, "hour", true);
					if(date.getDate() === newdate.getDate())
						return  this._findActive(newdate, mode, calendar);
				}
			}
		},
		"0":{//days
			_changeStep:1,
			_keyshift:function(date, mode, calendar){
				var newdate = date;
				if(mode === "pgup" || mode === "pgdown")
					newdate = smdui.Date.add(date, (mode==="pgdown"?1:-1), "month");
				else if(mode === "bottom")
					newdate = new Date(date.getFullYear(), date.getMonth()+1, 0);
				else if(mode === "top")
					newdate = new Date(date.setDate(1));
				else if(mode === "left" || mode === "right")
					newdate = smdui.Date.add(date, (mode==="right"?1:-1), "day");
				else if(mode === "up" || mode === "down")
					newdate = smdui.Date.add(date, (mode==="down"?1:-1), "week");
				
				if(!calendar._checkDate(newdate))
					newdate = calendar._findActive(date, mode);
				
				if(newdate)
					calendar.selectDate(newdate, true);
				return "smdui_cal_day";
			},
			
		},
		"1":{	//months
			_isBlocked: function(i,calendar){
				var blocked = false, minYear, maxYear,
				min = calendar._settings.minDate||null,
				max = calendar._settings.maxDate||null,
				year = calendar._settings.date.getFullYear();

				if(min && max){
                    minYear = min.getFullYear();
                    maxYear = max.getFullYear();
                    if(year<minYear||year==minYear&&min.getMonth()>i || year>maxYear||year==maxYear&&max.getMonth()<i)
						blocked = true;
				}
				return blocked;
			},
			_correctDate: function(date,calendar){
				if(date < calendar._settings.minDate){
					date = smdui.Date.copy(calendar._settings.minDate);
				}
				else if(date > calendar._settings.maxDate){
					date = smdui.Date.copy(calendar._settings.maxDate);
				}
				return date;
			},
			_getTitle:function(date){ return date.getFullYear(); },
			_getContent:function(i){ return smdui.i18n.calendar.monthShort[i]; },
			_setContent:function(next, i){ if(i!=next.getMonth()) next.setDate(1);next.setMonth(i); },
			_changeStep:12,
			_keyshift:function(date, mode, calendar){
				var newdate = date;
				if(mode === "pgup" || mode === "pgdown")
					newdate = smdui.Date.add(date, (mode==="pgdown"?1:-1), "year");
				else if(mode === "bottom")
					newdate = new Date(date.setMonth(11));
				else if(mode === "top")
					newdate = new Date(date.setMonth(0));
				else if(mode === "left" || mode === "right")
					newdate = smdui.Date.add(date, (mode==="right"?1:-1), "month");
				else if(mode === "up" || mode === "down")
					newdate = smdui.Date.add(date, (mode==="down"?4:-4), "month");

				if(!calendar._checkDate(newdate))
					newdate = calendar._findActive(date, mode);
				
				if(newdate){
					calendar._update_zoom_level(newdate);
					calendar.selectDate(newdate, false);
				}
				
				return "smdui_cal_block";
			}
		},
		"2":{	//years
			_isBlocked: function(i,calendar){
				i += calendar._zoom_start_date;
				var blocked = false;
				var min = calendar._settings.minDate;
				var max = calendar._settings.maxDate;

				if( min && max && (min.getFullYear()>i || max.getFullYear()<i)){
					blocked = true;
				}
				return blocked;
			},
			_correctDate: function(date,calendar){
				if(date < calendar._settings.minDate){
					date = smdui.Date.copy(calendar._settings.minDate);
				}
				else if(date > calendar._settings.maxDate){
					date = smdui.Date.copy(calendar._settings.maxDate);
				}
				return date;
			},
			_getTitle:function(date, calendar){
				var start = date.getFullYear();
				calendar._zoom_start_date = start = start - start%10 - 1;
				return start+" - "+(start+10 + 1);
			},
			_getContent:function(i, calendar){ return calendar._zoom_start_date+i; },
			_setContent:function(next, i, calendar){ next.setFullYear(calendar._zoom_start_date+i); },
			_changeStep:12*10,
			_keyshift:function(date, mode, calendar){
				var newdate = date;
				if(mode === "pgup" || mode === "pgdown")
					newdate = smdui.Date.add(date, (mode==="pgdown"?10:-10), "year");
				else if(mode === "bottom")
					newdate = new Date(date.setYear(calendar._zoom_start_date+10));
				else if(mode === "top")
					newdate = new Date(date.setYear(calendar._zoom_start_date));
				else if(mode === "left" || mode === "right")
					newdate = smdui.Date.add(date, (mode==="right"?1:-1), "year");
				else if(mode === "up" || mode === "down")
					newdate = smdui.Date.add(date, (mode==="down"?4:-4), "year");

				if(!calendar._checkDate(newdate))
					newdate = calendar._findActive(date, mode);
				
				if(newdate){
					calendar._update_zoom_level(newdate);
					calendar.selectDate(newdate, false);
				}

				return "smdui_cal_block";
			}
		}
	},
	_correctBlockedTime: function(){
		var i, isDisabledHour, isDisabledMinutes;
		isDisabledHour = this._zoom_logic[-1]._isBlocked.call(this,this._settings.date.getHours());
		if(isDisabledHour){
			for (i= 0; i< 24; i++){
				if(!this._zoom_logic[-1]._isBlocked.call(this,i)){
					this._settings.date.setHours(i);
					break;
				}
			}
		}
		isDisabledMinutes = this._zoom_logic[-2]._isBlocked.call(this,this._settings.date.getMinutes());
		if(isDisabledMinutes){
			for (i=0; i<60; i+=this._settings.minuteStep){
				if(!this._zoom_logic[-2]._isBlocked.call(this,i)){
					this._settings.date.setMinutes(i);
					break;
				}
			}
		}
	},
	_update_zoom_level:function(date){
		var config, css, height, i, index,  sections, selected, type, width, zlogic, value, temp;
		var html = "";

		config = this._settings;
		index = config.weekHeader?2: 1;
		zlogic = this._zoom_logic[this._zoom_level];
		sections  = this._contentobj.childNodes;

		if (date){
			config.date = date;
		}

		type = config.type;



		//store width and height of draw area
		if (!this._zoom_size){
			/*this._reserve_box_height = sections[index].offsetHeight +(index==2?sections[1].offsetHeight:0);*/

			this._reserve_box_height = this._contentobj.offsetHeight - config.headerHeight ;
			if(type != "year" && type != "month")
				this._reserve_box_height -= config.timepickerHeight;
			else if(this._icons){
				this._reserve_box_height -= 10;
			}
			this._reserve_box_width = sections[index].offsetWidth;
			this._zoom_size = 1;
		}

		//main section
		if (this._zoom_in){
			//hours and minutes
			height = this._reserve_box_height/6;
			var timeColNum = 6;
			var timeFormat = this._calendarTime||smdui.i18n.timeFormat;
			var enLocale = timeFormat.match(/%([a,A])/);
			if(enLocale)
				timeColNum++;
			width = parseInt((this._reserve_box_width-3)/timeColNum,10);

			html += "<div class='smdui_time_header'>"+this._timeHeaderTemplate(width,enLocale)+"</div>";
			html += "<div  class='smdui_cal_body' style='height:"+this._reserve_box_height+"px'>";

			// check and change blocked selected time
			this._correctBlockedTime();

			html += "<div class='smdui_hours'>";
			selected = config.date.getHours();
			temp = smdui.Date.copy(config.date);

			for (i= 0; i< 24; i++){
				css="";
				if(enLocale){
					if(i%4===0){
						var label = (!i ? smdui.i18n.am[0] : (i==12?smdui.i18n.pm[0]:""));
						html += "<div class='smdui_cal_block_empty"+css+"' style='"+this._getCalSizesString(width,height)+"clear:both;"+"'>"+label+"</div>";
					}
				}
				if(this._zoom_logic[-1]._isBlocked.call(this,i)){
					css += " smdui_cal_day_disabled";
				}
				else if(selected ==  i)
					css += " smdui_selected";

				
				temp.setHours(i);

				html += "<div aria-label='"+smdui.Date.dateToStr(smdui.i18n.aria.hourFormat)(temp)+"' role='gridcell'"+
					" tabindex='"+(selected==i?"0":"-1")+"' aria-selected='"+(selected==i?"true":"false")+
					"' class='smdui_cal_block"+css+"' data-value='"+i+"' style='"+
					this._getCalSizesString(width,height)+(i%4===0&&!enLocale?"clear:both;":"")+"'>"+smdui.Date.toFixed(enLocale?(!i||i==12?12:i%12):i)+"</div>";
			}
			html += "</div>";

			html += "<div class='smdui_minutes'>";
			selected = config.date.getMinutes();
			temp = smdui.Date.copy(config.date);


			for (i=0; i<60; i+=config.minuteStep){
				css = "";
				if(this._zoom_logic[-2]._isBlocked.call(this,i)){
					css = " smdui_cal_day_disabled";
				}
				else if(selected ==  i)
					css = " smdui_selected";

				temp.setMinutes(i);

				html += "<div aria-label='"+smdui.Date.dateToStr(smdui.i18n.aria.minuteFormat)(temp)+"' role='gridcell' tabindex='"+(selected==i?"0":"-1")+
					"' aria-selected='"+(selected==i?"true":"false")+"' class='smdui_cal_block smdui_cal_block_min"+css+"' data-value='"+i+"' style='"+
					this._getCalSizesString(width,height)+(i%2===0?"clear:both;":"")+"'>"+smdui.Date.toFixed(i)+"</div>";
			}
			html += "</div>";

			html += "</div>";
			html += "<div  class='smdui_time_footer'>"+this._timeButtonsTemplate()+"</div>";
			this._contentobj.innerHTML = html;
		} else {
			//years and months
			
			//reset header
			var header = sections[0].childNodes;
			var labels = smdui.i18n.aria["nav"+(this._zoom_level==1?"Year":"Decade")];
			header[0].innerHTML = zlogic._getTitle(config.date, this);
			header[1].setAttribute("aria-label", labels[0]);
			header[2].setAttribute("aria-label", labels[1]);

			height = this._reserve_box_height/3;
			width = this._reserve_box_width/4;
            if(this._checkDate(config.date))
				selected = (this._zoom_level==1?config.date.getMonth():config.date.getFullYear());
			for (i=0; i<12; i++){
				css = (selected == (this._zoom_level==1?i:zlogic._getContent(i, this)) ? " smdui_selected" : "");
				if(zlogic._isBlocked(i,this)){
					css += " smdui_cal_day_disabled";
				}

				var format = smdui.i18n.aria[(this._zoom_level==1?"month":"year")+"Format"];
				html+="<div role='gridcell' aria-label='"+smdui.Date.dateToStr(format)(config.date)+
					"' tabindex='"+(css.indexOf("selected")!==-1?"0":"-1")+
					"' aria-selected='"+(css.indexOf("selected")!==-1?"true":"false")+
					"' class='smdui_cal_block"+css+"' data-value='"+i+"' style='"+this._getCalSizesString(width,height)+"'>"+
					zlogic._getContent(i, this)+"</div>";
			}
			if(index-1){
				sections[index-1].style.display = "none";
			}
			sections[index].innerHTML = html;
			if(type != "year" && type != "month"){
				if(!sections[index+1])
					this._contentobj.innerHTML += "<div  class='smdui_time_footer'>"+this._timeButtonsTemplate()+"</div>";
				else
					sections[index+1].innerHTML=this._timeButtonsTemplate();
			}
			sections[index].style.height = this._reserve_box_height+"px";
		}
	},
	_getCalSizesString: function(width,height){
		return "width:"+width+"px; height:"+height+"px; line-height:"+height+"px;";
	},
	_timeButtonsTemplate: function(){
		return "<input type='button' style='width:100%' class='smdui_cal_done' value='"+smdui.i18n.calendar.done+"'>";
	},
	_timeHeaderTemplate: function(width,enLocale){
		var w1 = width*(enLocale?5:4);
		var w2 = width*2;
		return "<div class='smdui_cal_hours' style='width:"+w1+"px'>"+smdui.i18n.calendar.hours+"</div><div class='smdui_cal_minutes' style='width:"+w2+"px'>"+smdui.i18n.calendar.minutes+"</div>";
	},
	_changeZoomLevel: function(zoom,date){
		var oldzoom = this._zoom_level;
		if(this.callEvent("onBeforeZoom",[zoom, oldzoom])){
			this._zoom_level = zoom;

			if(zoom)
				this._update_zoom_level(date);
			else
				this.showCalendar(date);
			this.callEvent("onAfterZoom",[zoom, oldzoom]);
		}
	},
	_correctDate:function(date){
		if(!this._checkDate(date) && this._zoom_logic[this._zoom_level]._correctDate)
			date = this._zoom_logic[this._zoom_level]._correctDate(date,this);
		return date;
	},
	_mode_selected:function(target){

		var next = this._locate_date(target);
		var zoom = this._zoom_level-(this._fixed?0:1);

        next = this._correctDate(next);
        if(this._checkDate(next)){
			this._changeZoomLevel(zoom, next);
			var type = this._settings.type;
			if(type == "month" || type == "year")
				this._selectDate(next);
		}
	},
	// selects date and redraw calendar
	_selectDate: function(date){
		if(this.callEvent("onBeforeDateSelect", [date])){
			this.selectDate(date, true);
			this.callEvent("onDateSelect", [date]);       // should be deleted in a future version
			this.callEvent("onAfterDateSelect", [date]);
		}
	},
	_locate_day:function(target){
		var cind = smdui.html.index(target) - (this._settings.weekNumber?1:0);
		var rind = smdui.html.index(target.parentNode);
		var date = smdui.Date.add(this._getDateBoundaries()._start, cind + rind*7, "day", true);
		if (this._settings.timepicker){
			date.setHours(this._settings.date.getHours());
			date.setMinutes(this._settings.date.getMinutes());
		}
		return date;
	},
	_locate_date:function(target){
		var value = target.getAttribute("data-value")*1;
		var level = (target.className.indexOf("smdui_cal_block_min")!=-1?this._zoom_level-1:this._zoom_level);
		var now = this._settings.date;
		var next = smdui.Date.copy(now);

		this._zoom_logic[level]._setContent(next, value, this);

		return next;
	},
	on_click:{
		smdui_cal_prev_button: function(e, id, target){
			this._changeDate(-1);
		},
		smdui_cal_next_button: function(e, id, target){
			this._changeDate(1);
		},
		smdui_cal_day_disabled: function(){
			return false;
		},
		smdui_cal_outside: function(){
			if(!this._settings.navigation)
				return false;
		},
		smdui_cal_day: function(e, id, target){
			var date = this._locate_day(target);
			this._selectDate(date);
		},
		smdui_cal_time:function(e){
			if(this._zoom_logic[this._zoom_level-1]){
				this._zoom_in = true;
				var zoom = this._zoom_level - 1;
				this._changeZoomLevel(zoom);
			}
		},
		smdui_range_time_start:function(){
			smdui.$$(this._settings.master)._time_mode = "start";
		},
		smdui_range_time_end:function(){
			smdui.$$(this._settings.master)._time_mode = "end";
		},
		smdui_cal_done:function(e){
			var date = smdui.Date.copy(this._settings.date);
			date = this._correctDate(date);
			this._selectDate(date);
		},
		smdui_cal_month_name:function(e){
			this._zoom_in = false;
			//maximum zoom reached
			if (this._zoom_level == 2 || !this._settings.monthSelect) return;

			var zoom = Math.max(this._zoom_level, 0) + 1;
			this._changeZoomLevel(zoom);
		},
		smdui_cal_block:function(e, id, trg){
			if(this._zoom_in){
				if(trg.className.indexOf('smdui_cal_day_disabled')!==-1)
					return false;
				var next = this._locate_date(trg);
				this._update_zoom_level(next);
			}
			else{
				if(trg.className.indexOf('smdui_cal_day_disabled')==-1)
					this._mode_selected(trg);
			}
		}
	},
	_string_to_date: function(date, format){
		if (!date){
			return smdui.Date.datePart(new Date());
		}
		if(typeof date == "string"){
			if (format)
				date = smdui.Date.strToDate(format)(date);
			else
				date=smdui.i18n.parseFormatDate(date);
		}

		return date;
	},
	_checkDate: function(date){
		var blockedDate = (this._settings.blockDates && this._settings.blockDates.call(this,date));
		var minDate = this._settings.minDate;
		var maxDate = this._settings.maxDate;
		var outOfRange = (date < minDate || date > maxDate);
		return !blockedDate &&!outOfRange;
	},
	_findActive:function(date, mode){
		var dir = (mode === "top" || mode ==="left" || mode === "pgup" || mode === "up") ? -1 : 1;
		var newdate = smdui.Date.add(date, dir, "day", true);
		if(this._checkDate(newdate))
			return newdate;
		else{
			var compare;
			if(this._zoom_level === 0) compare = (date.getMonth() === newdate.getMonth());
			else if(this._zoom_level === 1 ) compare = (date.getFullYear() === newdate.getFullYear());
			else if(this._zoom_level === 2) compare = (newdate.getFullYear() > this._zoom_start_date && newdate.getFullYear() < this._zoom_start_date+10);

			if(compare)
				return this._findActive(newdate, mode);
		}
	},
	showCalendar: function(date) {
		date = this._string_to_date(date);
		this._settings.date = date;
		this.render();
		this.resize();
	},
	getSelectedDate: function() {
        return (this._selected_date)?smdui.Date.copy(this._selected_date):this._selected_date;

	},
	getVisibleDate: function() {
		return smdui.Date.copy(this._settings.date);
	},
	setValue: function(date, format){
        this.selectDate(date, true);
	},
	getValue: function(format){
		var date = this.getSelectedDate();
		if (format)
			date = smdui.Date.dateToStr(format)(date);
		return date;
	},
	selectDate: function(date, show){
        if(date){
            date = this._string_to_date(date);
            this._selected_date = date;
            this._selected_date_part = smdui.Date.datePart(smdui.Date.copy(date));
        }
        else{ //deselect
            this._selected_date = null;
            this._selected_date_part = null;
	        if(this._settings.date){
		        smdui.Date.datePart(this._settings.date);
	        }
        }

		if (show)
			this.showCalendar(date);
		else if(show !==false)
			this.render();

		this.callEvent("onChange",[date]);
	}, 
	locate:function(){ return null; }
	
}, smdui.KeysNavigation, smdui.MouseEvents, smdui.ui.view, smdui.EventSystem);

smdui.protoUI({
	name:"daterange",
	defaults:{
		button:false,
		icons:false,
		calendarCount:2,
		borderless:false
	},
	$init:function(config){
		config.calendar = config.calendar || {};
		config.value = this._correct_value(config.value);
		delete config.calendar.type; // other types are not implemented
		
		this._viewobj.className += " smdui_daterange";
		this._zoom_level = this._types[config.calendar.type] || 0;

		var cols = [],
			skinConf = smdui.skin.$active.calendar,
			cheight = skinConf && skinConf.height ? skinConf.height : 250,
			cwidth = skinConf && skinConf.width ? skinConf.width : 250,
			calendar = smdui.extend({ view:"calendar", width:cwidth, height:cheight }, config.calendar || {}, true),
			count = config.calendarCount = this._zoom_level === 0 ? (config.calendarCount || this.defaults.calendarCount) : this.defaults.calendarCount,
			basecss = (calendar.css?calendar.css + " ":"")+"smdui_range_",
			start = config.value.start || new Date();
		
		for(var i = 0; i<count; i++){
			var date = smdui.Date.add(start, this._steps[this._zoom_level]*i, "month", true);

			smdui.extend(calendar, {
				events:smdui.bind(this._isInRange, this),
				css:basecss+(count ===1?"":(i === 0 ? "0" : (i+1 == count ? "N" :"1"))),
				timepicker: this._zoom_level === 0?config.timepicker:false,
				borderless:true,
				date:date,
				master:config.id
			}, true);
			
			cols.push(smdui.copy(calendar));
		}


		config.rows = [
			{ type:"clean", cols: cols},
			this._footer_row(config, cwidth*count)
		];
		
		config.height = config.height || (calendar.height+(config.icons || config.button?35:0));
		config.type = "line";

		this.$ready.push(this._after_init);

		smdui.event(this.$view, "keydown", smdui.bind(function(e){
			this._onKeyPress( e.which || e.keyCode, e);
		}, this));
	},
	value_setter:function(value){
		return this._correct_value(value);
	},
	getValue:function(){
		return this._settings.value;
	},
	setValue:function(value, silent){
		value = this._correct_value(value);
		this._settings.value = value;

		var start = value.start || value.end || new Date();

		if(!silent){
			this._cals[0].showCalendar(value.start);
			
			for(var i = 1; i<this._cals.length; i++){
				this._cals[i]._settings.date = start;
				this._changeDateSilent(this._cals[i], 1, i);
			}
		}
		this.callEvent("onChange", [value]);
		this.refresh();
	},
	refresh:function(){
		var v = this._settings.value;
		for(var i = 0; i<this._cals.length; i++){

			if(this._cals[i]._zoom_level === this._zoom_level){
				smdui.html.removeCss(this._cals[i].$view, "smdui_cal_timepicker");
				smdui.html.removeCss(this._cals[i].$view, "smdui_range_timepicker");
				

				var rel = this._related_date(this._cals[i].getVisibleDate());
				if(rel.start || rel.end){
					this._cals[i]._settings.date = rel.start || rel.end;
					if(this._settings.timepicker){
						var css = "smdui_"+(rel.start && rel.end?"range":"cal")+"_timepicker";
						smdui.html.addCss(this._cals[i].$view, css);
					}
				}
				else
					smdui.Date.datePart(this._cals[i]._settings.date);

				this._cals[i].refresh();
			}
		}
	},
	addToRange:function(date){
		var value = this._add_date(this._string_to_date(date));
		this.setValue(value);
	},
	_icons:[
		{
			template:function(){
				return "<span role='button' tabindex='0' class='smdui_cal_icon_today smdui_cal_icon'>"+smdui.i18n.calendar.today+"</span>";
			},
			on_click:{
				"smdui_cal_icon_today":function(){
					this.addToRange(new Date());
					this.callEvent("onTodaySet",[this.getValue()]);
				}
			}
		},
		{
			template:function(){
				return "<span role='button' tabindex='0' class='smdui_cal_icon_clear smdui_cal_icon'>"+smdui.i18n.calendar.clear+"</span>";
			},
			on_click:{
				"smdui_cal_icon_clear":function(){
					this.setValue("");
					this.callEvent("onDateClear", []);
				}
			}
		}
	],
	_icons_template:function(icons){
		if(!icons)
			return { width:0};
		else{
			icons = (typeof icons =="object") ? icons:this._icons; //custom or default 
			var icons_template = { css:"smdui_cal_footer ", borderless:true, height:30, template:"<div class='smdui_cal_icons'>", onClick:{}};

			for(var i = 0; i<icons.length; i++){
				if(icons[i].template){
					var template = (typeof(icons[i].template) == "function"?icons[i].template: smdui.template(icons[i].template));
					icons_template.template += template.call(this);
				}	
				if(icons[i].on_click){
					for(var k in icons[i].on_click){
						icons_template.onClick[k] = smdui.bind(icons[i].on_click[k], this);
					}
				}
			}
			icons_template.template += "</div>";
			icons_template.width = smdui.html.getTextSize(icons_template.template).width+30;
			return icons_template;
		}
	},
	_footer_row:function(config, width){
		var button = { view:"button", value:smdui.i18n.calendar.done,
			minWidth:100, maxWidth:230,
			align:"center", height:30, click:function(){
				this.getParentView().getParentView().hide();
		}};

		var icons = this._icons_template(config.icons);

		var row = { css:"smdui_range_footer",  cols:[
			{ width:icons.width }
		]};
		if((config.button || config.icons) && (icons.width*2+button.minWidth) > width)
			row.cols[0].width = 0;

		row.cols.push(config.button ? button : {});
		row.cols.push(icons);

		return row;
	},
	_types:{
		"time":-1,
		"month":1,
		"year":2
	},
	_steps:{
		0:1,
		1:12,
		2:120
	},
	_correct_value:function(value){
		if(!value) value = { start:null, end:null};

		if(!value.start && !value.end)
			value = {start: value};
		
		value.end = this._string_to_date(value.end) || null;
		value.start = this._string_to_date(value.start) || null;

		if((value.end && value.end < value.start) || !value.start)
			value.end = [value.start, value.start = value.end][0];
		return value;
	},
	_string_to_date:function(date, format){
		if(typeof date == "string"){
			if (format)
				date = smdui.Date.strToDate(format)(date);
			else
				date=smdui.i18n.parseFormatDate(date);
		}
		return isNaN(date*1) ? null : date;
	},
	_isInRange:function(date){
		var v = this._settings.value,
			s = v.start? smdui.Date.datePart(smdui.Date.copy(v.start)) : null,
			e = v.end ? smdui.Date.datePart(smdui.Date.copy(v.end)) : null,
			d = smdui.Date.datePart(date),
			css = "";
		
		if(d>=s && e && d<=e)
			css = "smdui_cal_range";
		if(smdui.Date.equal(d, s))
			css = "smdui_cal_range_start";
		if(smdui.Date.equal(d, e))
			css = "smdui_cal_range_end";

		var holiday =smdui.Date.isHoliday(date)+" " || "";
		return css+" "+holiday;
	},
	_after_init:function(){
		var cals = this._cals = this.getChildViews()[0].getChildViews();
		var range = this;

		this._cals_hash = {};

		for(var i = 0; i<cals.length; i++){
			this._cals_hash[cals[i].config.id] = i;

			//events
			cals[i].attachEvent("onBeforeDateSelect", function(date){ return range._on_date_select(this, date); });
			cals[i].attachEvent("onBeforeZoom", function(zoom){ return range._before_zoom(this, zoom); });
			
			if(i===0 || i  === cals.length-1){
				cals[i].attachEvent("onAfterMonthChange", smdui.bind(this._month_change, this));
				cals[i].attachEvent("onAfterZoom", function(zoom, oldzoom){ range._after_zoom(this, zoom, oldzoom);});
			}
		}
		if(this._settings.timepicker)
			this.refresh();
	},
	_before_zoom:function(view, zoom){
		var ind = this._getIndexById(view.config.id);

		if(zoom >=0 && ind>0 && ind !== this._cals.length-1)
			return false;
		if(zoom ===-1){ //time mode
			var rel = this._related_date(view.getVisibleDate());
			if(rel.start && rel.end) //both dates are in one calendar
				view._settings.date = rel[this._time_mode];
		}
		return true;
	},
	_month_change:function(now, prev){
		var dir = now>prev ? 1: -1;
		var start = now>prev ? this._cals[this._cals.length-1] : this._cals[0];
		var step = start._zoom_logic[start._zoom_level]._changeStep;

		this._shift(dir, step, start);
		this.refresh();
	},
	_after_zoom:function(start, zoom, oldzoom){
		var step = start._zoom_logic[start._zoom_level]._changeStep;
		var ind = this._getIndexById(start.config.id);
		var dir = ind === 0 ? 1 :-1;
		if(!this._cals[ind+dir]) 
			return;
		
		var next = this._cals[ind+dir]._settings.date;
		
		if(oldzoom>zoom && zoom >=0){
			var diff = 0;
			if(zoom === 1){ //year was changed 
				var year = next.getFullYear();
				if(this._zoom_level || (dir === -1 && next.getMonth() === 11) || (dir ===1 && next.getMonth() === 0))
					year = year - dir;
				diff = start._settings.date.getFullYear()-year;
			}
			else if(zoom === 0 ){//month was changed
				var month = next.getMonth()-dir;
				if(month === 12 || month ==-1)
					month = (month === -1) ? 11: 0;
				
				diff = start._settings.date.getMonth()-month;
			}
			this._shift(diff, step, start);
			this.refresh();
		}
	},
	_changeDateSilent:function(view, dir, step){
		view.blockEvent();
		if(view._zoom_level>=0)
			view._changeDate(dir, step);
		view.unblockEvent();
	},
	_getIndexById:function(id){
		return this._cals_hash[id];
	},
	_shift:function(dir, step, start){
		for(var i =0; i<this._cals.length; i++){
			var next = this._cals[i];
			if(!start || next.config.id !==start.config.id)
				this._changeDateSilent(next, dir, step);
		}
	},
	_related_date:function(date){
		var v = this._settings.value;
		var rel = {};
		if(v.start && v.start.getYear() === date.getYear() && v.start.getMonth() === date.getMonth())
			rel.start = v.start;
		if(v.end && v.end.getYear() === date.getYear() && v.end.getMonth() === date.getMonth())
			rel.end = v.end;
		return rel;
	},
	_set_time:function(date, source){
		date.setHours(source.getHours());
		date.setMinutes(source.getMinutes());
		date.setSeconds(source.getSeconds());
		date.setMilliseconds(source.getMilliseconds());
	},
	_add_date:function(date, ind){
		var v = smdui.copy(this._settings.value);
		//year, month
		if(this._zoom_level !==0 && !smdui.isUndefined(ind)){
			var key = ind?"end":"start";
			v[key] = date;
		}
		else{
			if(v.start && !v.end)
				v.end = date;
			else {
				v.start = date;
				v.end = null;
			}
		}
		
		return v;
	},
	_on_date_select:function(view, date){
		if(this.callEvent("onBeforeDateSelect", [date])){
			var v = this._settings.value;

			if(view._zoom_level<0){ //time set
				var rel = smdui.copy(this._related_date(date)),
					reldate;
				
				reldate = (rel.start && rel.end) ? rel[this._time_mode] : rel.start || rel.end;
				if(reldate)
					this._set_time(reldate, date);

				view._zoom_level = 0;

				v = smdui.extend(smdui.copy(v), rel, true);
			}
			else{
				var vis = view.getVisibleDate();
				var ind = this._getIndexById(view.config.id);
				
				if(date.getMonth() !== vis.getMonth() && (ind ===0 || ind === this._cals.length-1)){
					var dir = date>vis? 1 : -1;
					this._shift(dir, 1);
				}
				v = this._add_date(date, ind);
			}

			if(view._zoom_level !== this._zoom_level)
				view.showCalendar(date);
			
			this.setValue(v, true);
			this.callEvent("onAfterDateSelect", [this.getValue()]);
		}

		return false;
	}
}, smdui.ui.layout);

smdui.protoUI({
	name:"daterangesuggest",
	defaults:{
		type:"daterange",
		body: {
			view:"daterange", icons:true, button:true, borderless:true
		}
	},
	getValue:function(){
		return this.getRange().getValue();
	},
	setValue:function(value){
		this.getRange().setValue(smdui.copy(value));
	},
	getRange:function(){
		return this.getBody();
	},
	getButton:function(){
		return this.getBody().getChildViews()[1].getChildViews()[1];
	},
	_setValue:function(value, hide){
		var master = smdui.$$(this._settings.master);

		if(master){
			master.setValue(value);
			if(hide) this.hide();
		}
		else
			this.setValue(value);
	},
	_set_on_popup_click:function(){
		var range  = this.getRange();
		range.attachEvent("onAfterDateSelect", smdui.bind(function(value) {this._setValue(value);}, this));
		range.attachEvent("onDateClear", smdui.bind(function(value) {this._setValue(value);}, this));
		range.attachEvent("onTodaySet", smdui.bind(function(value) {this._setValue(value);}, this));
	}
}, smdui.ui.suggest);


smdui.protoUI({
	$cssName:"datepicker",
	name:"daterangepicker",
	$init:function(){
		//set non-empty initial value
		this._settings.value = {};
	},
	_init_popup:function(){
		var obj = this._settings;
		if (obj.suggest)
			obj.popup = obj.suggest;
		else if (!obj.popup){
			obj.popup = obj.suggest = this.suggest_setter({
				view:"daterangesuggest", body:{
					timepicker:obj.timepicker, calendarCount:obj.calendarCount, height:250+(obj.button || obj.icons?30:0)
				}
			});
		}
		this._init_once = function(){};
	},
	$prepareValue:function(value){
		value = value || {};
		value.start = smdui.ui.datepicker.prototype.$prepareValue.call(this, value.start?value.start:null);
		value.end = smdui.ui.datepicker.prototype.$prepareValue.call(this, value.end?value.end:null);
		return value;
	},
	$compareValue:function(oldvalue, value){
		var compare = smdui.ui.datepicker.prototype.$compareValue;
		var start = compare.call(this, oldvalue.start, value.start);
		var end = compare.call(this, oldvalue.end, value.end);

		return (start && end);
	},
	$setValue:function(value){
		value = value || {};

		var popup =  smdui.$$(this._settings.popup.toString());
		var daterange = popup.getRange();

		this._settings.text = (value.start?this._get_visible_text(value.start):"")+(value.end?(" - "+ this._get_visible_text(value.end)):"");
		this._set_visible_text();
	},
	$render:function(obj){
		obj.value = this.$prepareValue(obj.value);
		this.$setValue(obj.value);
	},
	getValue:function(){

		var type = this._settings.type;
		//time mode
		var timeMode = (type == "time");
		//date and time mode
		var timepicker = this.config.timepicker;

		var value = this._settings.value;

		if(this._settings.stringResult){
			var formatStr =smdui.i18n.parseFormatStr;
			if(timeMode) 
				formatStr = smdui.i18n.parseTimeFormatStr;
			if(this._formatStr && (type == "month" || type == "year")){
				formatStr = this._formatStr;
			}

			return this._formatValue(formatStr, value);
		}
		
		return value||null;
	},
	_formatValue:function(format, value){
		var popup =  smdui.$$(this._settings.popup.toString());
		var daterange = popup.getRange();
		value = smdui.copy(daterange._correct_value(value));

		if(value.start) value.start = format(value.start);
		if(value.end) value.end = format(value.end);
		return value;
	}
}, smdui.ui.datepicker);



smdui.protoUI({
	name:"resizer",
	defaults:{
		width:7, height:7
	},
	$init:function(config){
		smdui.assert(this.getParentView(), "Resizer can't be initialized outside a layout");
		this._viewobj.className += " smdui_resizer";
		var space = this.getParentView()._margin;
		
		smdui._event(this._viewobj, smdui.env.mouse.down, this._rsDown, {bind:this});
		smdui.event(document.body, smdui.env.mouse.up, this._rsUp, {bind:this});

		var dir = this._getResizeDir();

		this._rs_started = false;
		this._resizer_dir = dir;

		this._resizer_dim = (dir=="x"?"width":"height");
		
		if (dir=="x")
			config.height = 0;
		else 
			config.width = 0;

		if (space>0){
			this._viewobj.className += " smdui_resizer_v"+dir;
			this._viewobj.style.marginRight = "-"+space+"px";
			if (dir == "x")	
				config.width = space;
			else
				config.height = space;
			this.$nospace = true;
		} else
			this._viewobj.className += " smdui_resizer_"+dir;
		
		this._viewobj.innerHTML = "<div class='smdui_resizer_content'></div>";
		if (dir == "y" && space>0) this._viewobj.style.marginBottom = "-"+(config.height||this.defaults.height)+"px";

		this._viewobj.setAttribute("tabindex", "-1");
		this._viewobj.setAttribute("aria-grabbed", "false");

	},
	_rsDown:function(e){
		var cells = this._getResizerCells();
		//some sibling can block resize
		if(cells && !this._settings.disabled){
			e = e||event;
			this._rs_started = true;
			this._rs_process = smdui.html.pos(e);
			this._rsLimit = [];
			this._viewobj.setAttribute("aria-grabbed", "true");
			
			for(var i=0; i<2; i++)
				cells[i].$view.setAttribute("aria-dropeffect", "move");
			this._viewobj.setAttribute("aria-dropeffect", "move");
			
			this._rsStart(e, cells[0]);
		}
	},
	_rsUp:function(){
		this._rs_started = false;
		this._rs_process = false;
	},
	_rsStart:function(e, cell){

		var dir,offset, pos,posParent,start;
		e = e||event;
		dir = this._resizer_dir;

		/*layout position:relative to place absolutely positioned elements in it*/
		this.getParentView()._viewobj.style.position = "relative";
		pos = smdui.html.offset(this._viewobj);
		posParent = smdui.html.offset(this.getParentView()._viewobj);
		start = pos[dir]-posParent[dir];
		offset = smdui.html.offset(cell.$view)[dir]- smdui.html.offset(this.getParentView().$view)[dir];

		this._rs_progress = [dir,cell, start, offset];
		/*resizer stick (resizerea ext)*/

		this._resizeStick = new smdui.ui.resizearea({
			container:this.getParentView()._viewobj,
			dir:dir,
			eventPos:this._rs_process[dir],
			start:start-1,
			height: this.$height,
			width: this.$width,
			border: 1,
			margin: this.getParentView()["_padding"+dir.toUpperCase()]
		});

		/*stops resizing on stick mouseup*/
		this._resizeStick.attachEvent("onResizeEnd", smdui.bind(this._rsEnd, this));
		/*needed to stop stick moving when the limit for dimension is reached*/
		this._resizeStick.attachEvent("onResize", smdui.bind(this._rsResizeHandler, this));

		smdui.html.addCss(document.body,"smdui_noselect",1);
	},
	_getResizeDir: function(){
		return this.getParentView()._vertical_orientation?"y":"x";
	},
	_rsResizeHandler:function(){
		var cells,config,cDiff,diff,dir,i,limits,limitSizes,sizes,totalSize;
		if(this._rs_progress){
			cells = this._getResizerCells();
			dir = this._rs_progress[0];
			/*vector distance between resizer and stick*/
			diff = this._resizeStick._last_result -this._rs_progress[2];
			/*new sizes for the resized cells, taking into account the stick position*/
			sizes = this._rsGetDiffCellSizes(cells,dir,diff);
			/*sum of cells dimensions*/
			totalSize = cells[0]["$"+this._resizer_dim]+cells[1]["$"+this._resizer_dim];
			/*max and min limits if they're set*/
			limits = (dir=="y"?["minHeight","maxHeight"]:["minWidth","maxWidth"]);
			for(i=0;i<2;i++){
				config = cells[i]._settings;
				cDiff = (i?-diff:diff);/*if cDiff is positive, the size of i cell is increased*/
				/*if size is bigger than max limit or size is smaller than min limit*/
				var min = config[limits[0]];
				var max = config[limits[1]];

				if(cDiff>0&&max&&max<=sizes[i] || cDiff<0&&(min||3)>=sizes[i]){
					this._rsLimit[i] = (cDiff>0?max:(min||3));
					/*new sizes, taking into account max and min limits*/
					limitSizes = this._rsGetLimitCellSizes(cells,dir);
					/*stick position*/
					this._resizeStick._dragobj.style[(dir=="y"?"top":"left")] = this._rs_progress[3] + limitSizes[0]+"px";
					return;
				}else if(sizes[i]<3){/*cells size can not be less than 1*/
					this._resizeStick._dragobj.style[(dir=="y"?"top":"left")] = this._rs_progress[3] + i*totalSize+1+"px";
				}else{
					this._rsLimit[i] = null;
				}
			}
		}
	},
	_getResizerCells:function(){
		var cells,i;
		cells = this.getParentView()._cells;
		for(i=0; i< cells.length;i++){
			if(cells[i]==this){
				if (!cells[i-1] || cells[i-1]._settings.$noresize) return null;
				if (!cells[i+1] || cells[i+1]._settings.$noresize) return null;
				return [cells[i-1],cells[i+1]];
			}
		}
	 },
	_rsEnd:function(result){
		if (typeof result == "undefined") return;

		var cells,dir,diff,i,size;
		var vertical = this.getParentView()._vertical_orientation;
		this._resizerStick = null;
		if (this._rs_progress){
			dir = this._rs_progress[0];
			diff = result-this._rs_progress[2];
			cells = this._getResizerCells();
			if(cells[0]&&cells[1]){
				/*new cell sizes*/
				size = this._rsGetCellSizes(cells,dir,diff);

				for (var i=0; i<2; i++){
					//cell has not fixed size, of fully fixed layout
					var cell_size = cells[i].$getSize(0,0);
					if (vertical?(cell_size[2] == cell_size[3]):(Math.abs(cell_size[1]-cell_size[0])<3)){
						/*set fixed sizes for both cells*/
						cells[i]._settings[this._resizer_dim]=size[i];
						if (cells[i]._bubble_size)
							cells[i]._bubble_size(this._resizer_dim, size[i], vertical);
					} else {
						var actualSize = cells[i].$view[vertical?"offsetHeight":"offsetWidth"];//cells[i]["$"+this._resizer_dim];
						cells[i]._settings.gravity = size[i]/actualSize*cells[i]._settings.gravity;
					}
				}

				cells[0].resize();

				for (var i = 0; i < 2; i++){
					if (cells[i].callEvent)
						cells[i].callEvent("onViewResize",[]);
					cells[i].$view.removeAttribute("aria-dropeffect");
				}
				smdui.callEvent("onLayoutResize", [cells]);
			}
			this._rs_progress = false;
		}
		this._rs_progress = false;
		this._rs_started = false;
		this._rsLimit = null;
		smdui.html.removeCss(document.body,"smdui_noselect");

		this._viewobj.setAttribute("aria-grabbed", "false");
		this._viewobj.removeAttribute("aria-dropeffect");
	},
	_rsGetLimitCellSizes: function(cells){
		var size1,size2,totalSize;
		totalSize = cells[0]["$"+this._resizer_dim]+cells[1]["$"+this._resizer_dim];
		if(this._rsLimit[0]){
			size1 = this._rsLimit[0];
			size2 = totalSize-size1;
		}
		else if(this._rsLimit[1]){
			size2 = this._rsLimit[1];
			size1 = totalSize-size2;
		}
		return [size1,size2];
	},
	_rsGetDiffCellSizes:function(cells,dir,diff){
		var sizes =[];
		var styleDim = this._resizer_dim=="height"?"offsetHeight":"offsetWidth";
		for(var i=0;i<2;i++)
			sizes[i] = cells[i].$view[styleDim]+(i?-1:1)*diff;
		return sizes;
	},
	_rsGetCellSizes:function(cells,dir,diff){
		var i,sizes,totalSize;
		/*if max or min dimentsions are set*/
		if(this._rsLimit[0]||this._rsLimit[1]){
			sizes = this._rsGetLimitCellSizes(cells,dir);
		}
		else{
			sizes = this._rsGetDiffCellSizes(cells,dir,diff);
			for(i =0; i<2;i++ ){
				/*if stick moving is stopped outsize cells borders*/
				if(sizes[i]<0){
					totalSize = sizes[0]+sizes[1];
					sizes[i] =1;
					sizes[1-i] = totalSize-1;
				}
			}

		}
		return sizes;
	}
}, smdui.MouseEvents, smdui.Destruction, smdui.ui.view);


smdui.protoUI({
	name:"multiview",
	defaults:{
		animate:{
		}
	},
	setValue:function(val){
		smdui.$$(val).show();
	},
	getValue:function(){
		return this.getActiveId();
	},
	$init:function(){
		this._active_cell = 0;
		this._vertical_orientation = 1;
		this._viewobj.style.position = "relative";
		this._viewobj.className += " smdui_multiview";
		this._back_queue = [];
	},
	_ask_render:function(cell_id, view_id){
		var cell = smdui.$$(cell_id);
		if (!cell._render_hash){
			cell._render_queue = [];
			cell._render_hash = {};			
		}
		if (!cell._render_hash[view_id]){
			cell._render_hash[view_id]=true;
			cell._render_queue.push(view_id);
		}
	},
	_render_activation:function(cell_id){ 
		var cell = smdui.$$(cell_id);
		if(this._settings.keepViews)
			cell._viewobj.style.display = "";
		/*back array*/
		if(this._back_queue[this._back_queue.length-2]!=cell_id){
			if(this._back_queue.length==10)
				this._back_queue.splice(0,1);
			this._back_queue.push(cell_id);
		}
		else 
			this._back_queue.splice(this._back_queue.length-1,1);	
		
		if (cell._render_hash){
			for (var i=0; i < cell._render_queue.length; i++){
				var subcell = smdui.$$(cell._render_queue[i]);
				//cell can be already destroyed
				if (subcell)
					subcell.render();
			}
				
			cell._render_queue = [];
			cell._render_hash = {};			
		}
	},
	addView:function(){
		var id = smdui.ui.baselayout.prototype.addView.apply(this, arguments);
		if(this._settings.keepViews)
			smdui.$$(id)._viewobj.style.display = "none";
		else
			smdui.html.remove(smdui.$$(id)._viewobj);
		return id;
	},
	_beforeRemoveView:function(index, view){
		//removing current view
		if (index == this._active_cell){
			var next = Math.max(index-1, 0);
			if (this._cells[next]){
				this._in_animation = false;
				this._show(this._cells[next], false);
			}
		}

		if (index < this._active_cell)
			this._active_cell--;
	},
	//necessary, as we want to ignore hide calls for elements in multiview
	_hide:function(){},
	_parse_cells:function(collection){
		collection = collection || this._collection; 

		for (var i=0; i < collection.length; i++)
			collection[i]._inner = this._settings.borderless?{top:1, left:1, right:1, bottom:1}:(this._settings._inner||{});
			
		smdui.ui.baselayout.prototype._parse_cells.call(this, collection);
		
		for (var i=1; i < this._cells.length; i++){
			if(this._settings.keepViews)
				this._cells[i]._viewobj.style.display = "none";
			else
				smdui.html.remove(this._cells[i]._viewobj);
		}

			
		for (var i=0; i<collection.length; i++){
			var cell = this._cells[i];
			if (cell._cells && !cell._render_borders) continue; 
			
			var _inner = cell._settings._inner;
			if (_inner.top) 
				cell._viewobj.style.borderTopWidth="0px";
			if (_inner.left) 
				cell._viewobj.style.borderLeftWidth="0px";
			if (_inner.right) 
				cell._viewobj.style.borderRightWidth="0px";
			if (_inner.bottom) 
				cell._viewobj.style.borderBottomWidth="0px";

			cell._viewobj.setAttribute("role", "tabpanel");
		}
		this._render_activation(this.getActiveId());
	},
	cells_setter:function(value){
		smdui.assert(value && value.length,"Multiview must have at least one view in 'cells'");
		this._collection = value;
	},
	_getDirection:function(next, active){
		var dir = (this._settings.animate || {}).direction;
		var vx = (dir == "top" || dir == "bottom");
		return 	 next < active ? (vx?"bottom":"right"):(vx?"top":"left");
	},
	_show:function(obj, animation_options){

		var parent = this.getParentView();
		if (parent && parent.getTabbar)
			parent.getTabbar().setValue(obj._settings.$id || obj._settings.id);

		 if (this._in_animation)
			return smdui.delay(this._show, this,[obj, animation_options],100);

		var _next_cell = -1;
		for (var i=0; i < this._cells.length; i++)
			if (this._cells[i]==obj){
				_next_cell = i;
				break;
			}
		if (_next_cell < 0 || _next_cell == this._active_cell)
			return;


		var prev = this._cells[this._active_cell];
		var next = this._cells[ _next_cell ];
		var size = prev.$getSize(0,0);

		//need to be moved in animate
		if((animation_options||typeof animation_options=="undefined")&&smdui.animate.isSupported() && this._settings.animate) {
			var aniset = smdui.extend({}, this._settings.animate);
			if(this._settings.keepViews)
				aniset.keepViews = true;
        	aniset.direction = this._getDirection(_next_cell,this._active_cell);
        	aniset = smdui.Settings._mergeSettings(animation_options||{}, aniset);

			var line = smdui.animate.formLine(
				next._viewobj,
                prev._viewobj,
				aniset);
			next.$getSize(0,0);
			next.$setSize(this._content_width,this._content_height);

			var callback_original = aniset.callback;
			aniset.callback = function(){
				smdui.animate.breakLine(line,this._settings.keepViews);
				this._in_animation = false;
				if (callback_original) callback_original.call(this);
				callback_original = aniset.master = aniset.callback = null;
				this.resize();
			};
			aniset.master = this;

			this._active_cell = _next_cell;
			this._render_activation(this.getActiveId());

			smdui.animate(line, aniset);
			this._in_animation = true;
		}
		else { // browsers which don't support transform and transition
			if(this._settings.keepViews){
				prev._viewobj.style.display = "none";
			}
			else{
				smdui.html.remove(prev._viewobj);
				this._viewobj.appendChild(this._cells[i]._viewobj);
			}

			this._active_cell = _next_cell;

			prev.resize();
			this._render_activation(this.getActiveId());
		}

		if (next.callEvent){
			next.callEvent("onViewShow",[]);
			smdui.ui.each(next, this._signal_hidden_cells);
		}

		this.callEvent("onViewChange",[prev._settings.id, next._settings.id]);
		
	},
	$getSize:function(dx, dy){
		smdui.debug_size_box_start(this, true);
		var size = this._cells[this._active_cell].$getSize(0, 0);
		if (this._settings.fitBiggest){
			for (var i=0; i<this._cells.length; i++)
				if (i != this._active_cell){
					var other = this._cells[i].$getSize(0, 0);
					for (var j = 0; j < 4; j++)
						size[j] = Math.max(size[j], other[j]);
				}
		}


		//get layout sizes
		var self_size = smdui.ui.baseview.prototype.$getSize.call(this, 0, 0);
		//use child settings if layout's one was not defined
		if (self_size[1] >= 100000) self_size[1]=0;
		if (self_size[3] >= 100000) self_size[3]=0;

		self_size[0] = (self_size[0] || size[0] ) +dx;
		self_size[1] = (self_size[1] || size[1] ) +dx;
		self_size[2] = (self_size[2] || size[2] ) +dy;
		self_size[3] = (self_size[3] || size[3] ) +dy;
		
		smdui.debug_size_box_end(this, self_size);
		
		return self_size;
	},
	$setSize:function(x,y){
		this._layout_sizes = [x,y];
		smdui.ui.baseview.prototype.$setSize.call(this,x,y);
		this._cells[this._active_cell].$setSize(x,y);
	},
	isVisible:function(base_id, cell_id){
		if (cell_id && cell_id != this.getActiveId()){
			if (base_id)
				this._ask_render(cell_id, base_id);
			return false;
		}
		return smdui.ui.view.prototype.isVisible.call(this, base_id, this._settings.id);
	},
	getActiveId:function(){
		return this._cells.length?this._cells[this._active_cell]._settings.id:null;
	},
	back:function(step){		
		step=step||1;
		if(this.callEvent("onBeforeBack",[this.getActiveId(), step])){
			if(this._back_queue.length>step){
				var viewId = this._back_queue[this._back_queue.length-step-1];
				smdui.$$(viewId).show();
				return viewId;
			}
			return null;
		}
		return null;

	}
},smdui.ui.baselayout);


smdui.protoUI({
	name:"form",
	defaults:{
		type:"form",
		autoheight:true
	},
	_default_height:-1,
	_form_classname:"smdui_form",
	_form_vertical:true,
	$init:function(){
		this._viewobj.setAttribute("role", "form");
	},
	$getSize:function(dx, dy){
		if (this._scroll_y && !this._settings.width) dx += smdui.ui.scrollSize;

		var sizes = smdui.ui.layout.prototype.$getSize.call(this, dx, dy);

		if (this._settings.scroll || !this._settings.autoheight){
			sizes[2] =  this._settings.height || this._settings.minHeight || 0;
			sizes[3] += 100000;
		}
		
		return sizes;
	}
}, smdui.ui.toolbar);


(function(){

	var controls = {};
	for(var i in smdui.UIManager._controls){
		controls[smdui.UIManager._controls[i]] = i;
	}
	var nav_controls = {
		9:'tab',
		38:'up',
		40:'down',
		37:'left',
		39:'right'
	};

	smdui.patterns = {
		phone:{ mask:"+# (###) ###-####", allow:/[0-9]/g },
		card: { mask:"#### #### #### ####", allow:/[0-9]/g },
		date: { mask:"####-##-## ##:##", allow:/[0-9]/g }
	};

	smdui.extend(smdui.ui.text, {
		$init:function(config){
			if(config.pattern){
				this.attachEvent("onKeyPress", function(code, e){
					if(e.ctrlKey || e.altKey)
						return;

					if(code>105 && code<112) //numpad operators
						code -=64;

					if(controls[code] && code !== 8 && code !==46){  //del && bsp
						if(!nav_controls[code])
							smdui.html.preventEvent(e);
						return;
					}

					smdui.html.preventEvent(e);
					this._on_key_pressed(e, code);
				});

				this.attachEvent("onAfterRender", this._after_render);
				this.getText = function(){ return this.getInputNode().value; };
				this._pattern = function(value, mode){
					if (mode === false)
						return this._getRawValue(value);
					else
						return this._matchPattern(value);
				};
				config.invalidMessage = config.invalidMessage || smdui.i18n.controls.invalidMessage;
			}
		},
		pattern_setter:function(value){
			var pattern = smdui.patterns[value] || value;
			
			if(typeof pattern =="string") pattern = { mask: pattern };
			pattern.allow =  pattern.allow || /[A-Za-z0-9]/g;
			
			this._patternScheme(pattern);
			return pattern;
		},
		_init_validation:function(){
			this.config.validate = this.config.validate || smdui.bind(function(){
				var value = this.getText();
				var raw = value.replace(this._pattern_chars, "");
				var matches = (value.toString().match(this._pattern_allows) || []).join("");
				return (matches.length == raw.length && value.length == this._settings.pattern.mask.length);
			}, this);
		},
		_after_render:function(){
			var ev =  smdui.env.isIE8?"propertychange":"input";
			
			smdui._event(this.getInputNode(), ev, function(e){
				var stamp =  (new Date()).valueOf();
				var width = this.$view.offsetWidth; //dark ie8 magic
				if(!this._property_stamp || stamp-this._property_stamp>100){
					this._property_stamp = stamp;
					this.$setValue(this.getText());
				}
			}, {bind:this});

			smdui._event(this.getInputNode(), "blur", function(e){
				this._applyChanges();
			}, {bind:this});
		},
		_patternScheme:function(pattern){
			var mask = pattern.mask, scheme = {}, chars = "", count = 0;
			
			for(var i = 0; i<mask.length; i++){
				if(mask[i] === "#"){
					scheme[i] = count; count++;
				}
				else{
					scheme[i] = false;
					if(chars.indexOf(mask[i]) === -1) chars+="\\"+mask[i];
				}
			}
			this._pattern_allows = pattern.allow;
			this._pattern_chars = new RegExp("["+chars+"]", "g");
			this._pattern_scheme = scheme;

			this._init_validation();
		},
		_on_key_pressed:function(e, code){
			var node = this.getInputNode();
			var value = node.value;
			var pos = smdui.html.getSelectionRange(node);
			var chr = "";

			if(code == 8 || code == 46){
				if(pos.start == pos.end){
					if(code == 8) pos.start--;
					else pos.end++;
				}
			}
			else{
				chr = String.fromCharCode(code);
				if(!e.shiftKey) chr = chr.toLowerCase();
			}

			value = value.substr(0, pos.start) + chr +value.substr(pos.end);
			pos = this._getCaretPos(chr, value.length, pos.start, code);

			this._input_code = code;
			this.$setValue(value);

			smdui.html.setSelectionRange(node, pos);
		},
		_getCaretPos:function(chr, len, pos, code){
			if((chr && chr.match(this._pattern_allows)) || (code ==8 || code ==46)){
				pos = chr ? pos+1 : pos;
				pos = this._fixCaretPos(pos, code);
			}
			else if(len-1 == pos && code !==8 && code !==46){
				var rest = this._settings.pattern.mask.indexOf("#", pos);
				if(rest>0) pos += rest;
			}
			return pos;
		},
		_fixCaretPos:function(pos, code){
			var prev = pos-(code !== 46)*1;

			if(this._pattern_scheme[prev] === false){
				pos = pos+(code ==8 ? -1: 1);
				return this._fixCaretPos(pos, code);
			}
			if(this._pattern_scheme[pos] === false && code !==8)
				return this._fixCaretPos(pos+1, code)-1;
			return pos;
		},
		_getRawValue:function(value){
			value = value || "";
			var matches = value.toString().match(this._pattern_allows) || [];
			return matches.join("").replace(this._pattern_chars, "");
		},
		_matchPattern:function(value){
			var raw = this._getRawValue(value),
				pattern = this._settings.pattern.mask,
				mask = this._settings.pattern.mask,
				scheme = this._pattern_scheme,
				end = false,
				index = 0,
				rawIndex = 0,
				rawLength = 0;

			for(var i in scheme){
				if(scheme[i]!==false){
					if(!end){
						index = i*1;
						rawIndex = scheme[i];
						var rchar = raw[rawIndex]||"";
						var next = raw[rawIndex+1];

						pattern = (rchar?pattern.substr(0, index):"") + rchar +(rchar && next?pattern.substr(index + 1):"");
						if(!next) end = true;
					}
					rawLength++;
				}
			}

			//finalize value with subsequent mask chars 
			var icode = this._input_code;
			if((icode && icode !== 8) || (!icode && rawLength-1 === rawIndex && pattern.length < mask.length)){
				if(raw){
					var nind = index+1;
					if(mask.charAt(nind)!=="#" && pattern.length < mask.length){
						var lind = mask.indexOf("#", nind);
						if(lind<0) lind = mask.length;
						pattern += mask.substr(nind, lind-nind);
					}
				}
				else if(icode !==46){
					pattern += mask.substr(0, mask.indexOf("#"));
				}
			}
			this._input_code = null;
			return pattern;
		}
	});

})();
smdui.protoUI({
	name:"gridsuggest",
	defaults:{
		type:"datatable",
		fitMaster:false,
		width:0,
		body:{
			navigation:true,
			autoheight:true,
			autowidth:true,
			select:true
		},
		filter:function(item, value){
			var text = this.config.template(item);
			if (text.toString().toLowerCase().indexOf(value.toLowerCase())===0) return true;
				return false;
		}
	},
	$init:function(obj){
		if (!obj.body.columns)
			obj.body.autoConfig = true;
		if (!obj.template)
			obj.template = smdui.bind(this._getText, this);
	},
	_getText:function(item, common){
		var grid = this.getBody();
		var value = this.config.textValue || grid.config.columns[0].id;
		return grid.getText(item.id, value);
	}
}, smdui.ui.suggest);
smdui.protoUI({
	name:"datasuggest",
	defaults:{
		type:"dataview",
		fitMaster:false,
		width:0,
		body:{
			xCount:3,
			autoheight:true,
			select:true
		}
	}
}, smdui.ui.suggest);


smdui.protoUI({
	name:"multiselect",
	$cssName:"richselect",
	defaults:{
        separator:","
	},
	_suggest_config:function(value){
		var isobj = !smdui.isArray(value) && typeof value == "object" && !value.name; 
		var suggest = { view:"checksuggest", separator:this.config.separator, buttonText: this.config.buttonText, button: this.config.button };

		if (this._settings.optionWidth)
			suggest.width = this._settings.optionWidth;
		else
			suggest.fitMaster = true;

		if (isobj)
			smdui.extend(suggest, value, true);

		var view = smdui.ui(suggest);
		var list = view.getList();
		if (typeof value == "string")
			list.load(value);
		else if (!isobj)
			list.parse(value);

		view.attachEvent("onShow",function(node,mode, point){
			view.setValue(smdui.$$(view._settings.master).config.value);
		});

		return view;
	},

	$setValue:function(value){
		if (!this._rendered_input) return;
		var popup = this.getPopup();
		var text = "";
		if(popup){
			text = popup.setValue(value);
			if(typeof text == "object"){
				text = text.join(this.config.separator+" ");
			}

		}
		this._settings.text = text;

		var node = this.getInputNode();
		node.innerHTML = text || this._get_div_placeholder();
	},
	getValue:function(){
		return this._settings.value||"";
	},
}, smdui.ui.richselect);

smdui.editors.multiselect = smdui.extend({
	popupType:"multiselect"
}, smdui.editors.richselect);

smdui.type(smdui.ui.list, {
	name:"multilist",
	templateStart:smdui.template('<div smdui_l_id="#!id#" class="{common.classname()}" style="width:{common.widthSize()}; height:{common.heightSize()}; overflow:hidden;" {common.aria()}>')
}, "default");

smdui.type(smdui.ui.list, {
	name:"checklist",
	templateStart:smdui.template('<div smdui_l_id="#!id#" {common.aria()} class="{common.classname()}" style="width:{common.widthSize()}; height:{common.heightSize()}; overflow:hidden; white-space:nowrap;">{common.checkbox()}'),
	checkbox: function(obj, common){
		var icon = obj.$checked?"fa-check-square":"fa-square-o";
		return "<span role='checkbox' tabindex='-1' aria-checked='"+(obj.$checked?"true":"false")+"' class='smdui_icon "+icon+"'></span>";
	},
	aria:function(obj){
		return "role='option' tabindex='-1' "+(obj.$checked?"aria-selected='true'":"");
	},
	template: smdui.template("#value#")
}, "default");


smdui.protoUI({
	name:"multisuggest",
	defaults:{
		separator:",",
		type:"layout",
		button:true,
		width:0,
		filter:function(item,value){
			var itemText = this.getItemText(item.id);
			return (itemText.toString().toLowerCase().indexOf(value.toLowerCase())>-1);
		},
		body:{
			rows:[
				{ view:"list", type:"multilist", borderless:true,  autoheight:true, yCount:5, multiselect:"touch", select:true,
				  on:{
					onItemClick: function(id){
						var popup = this.getParentView().getParentView();
						smdui.delay(function(){
							popup._toggleOption(id);
						});
					}
				}},
				{ view:"button", click:function(){
					var suggest = this.getParentView().getParentView();
					suggest.setMasterValue({ id:suggest.getValue() });
					suggest.hide();
				}}
			]
		}
	},

	_toggleOption: function(id, ev){
		var value = this.getValue();
		var values = smdui.toArray(value?this.getValue().split(this._settings.separator):[]);

		if(values.find(id)<0){
			values.push(id);
		}
		else
			values.remove(id);
		var master = smdui.$$(this._settings.master);
		if(master){
			master.setValue(values.join(this._settings.separator));
		}
		else
			this.setValue(values);

		if(ev){ //only for clicks in checksuggest
			var checkbox = this.getList().getItemNode(id).getElementsByTagName("SPAN");
			if(checkbox && checkbox.length) checkbox[0].focus();
		}
	},
	_get_extendable_cell:function(obj){
		return obj.rows[0];
	},
	_set_on_popup_click:function(){
		var button = this.getButton();
		var text = (this._settings.button?(this._settings.buttonText || smdui.i18n.controls.select):0);
		if(button){
			if(text){
				button._settings.value = text;
				button.refresh();
			}
			else
				button.hide();
		}
	},
	getButton:function(){
		return this.getBody().getChildViews()[1];
	},
	getList:function(){
		return this.getBody().getChildViews()[0];
	},
	setValue:function(value){
		var text = [];
		var list = this.getList();
		list.unselect();

		if (value){
			if (typeof value == "string")
				value = value.split(this.config.separator);

			if (value[0]){
				for (var i = 0; i < value.length; i++){
					if (list.getItem(value[i])){
						if(list.exists(value[i]))
							list.select(value[i], true);
						text.push(this.getItemText(value[i]));
					}
				}
			}
		}

		this._settings.value = value?value.join(this.config.separator):"";
		return text;
	},
	getValue:function(){
		return this._settings.value;
	}
}, smdui.ui.suggest);

smdui.protoUI({
	name:"checksuggest",
	defaults:{
		button:false,
		body:{
			rows:[
				{ view:"list",  css:"smdui_multilist", borderless:true, autoheight:true, yCount:5, select: true,
					type:"checklist",
					on:{
						onItemClick: function(id, e){
							var item = this.getItem(id);
							item.$checked = item.$checked?0:1;
							this.refresh(id);
							var popup = this.getParentView().getParentView();
							popup._toggleOption(id, e);
						}
					}
				},
				{ view:"button", click:function(){
					var suggest = this.getParentView().getParentView();
					suggest.setMasterValue({ id:suggest.getValue() });
					suggest.hide();
				}}
			]
		}
	},
	$init: function(){
		this._valueHistory = {};
		this.$ready.push(this._onReady);
	},
	_onReady: function(){
		var list = this.getList();
		if(list.config.dataFeed){
			var suggest = this;
			list.attachEvent("onAfterLoad", function(){
				suggest.setValue(suggest._settings.value);
			});
			list.getItem = function(id){
				return this.data.pull[id] || suggest._valueHistory[id];
			};
		}

	},
	$enterKey: function(popup,list) {
		if (list.count && list.count()){
			if (popup.isVisible()) {
				var value = list.getSelectedId(false, true);
				if(value){
					this._toggleOption(value);
				}
				popup.hide(true);
			} else {
				popup.show(this._last_input_target);
			}
		} else {
			if (popup.isVisible())
				popup.hide(true);
		}
	},
	_show_selection: function(){
		var list = this.getList();
		if( list.select)
			list.unselect();
	},
	setValue:function(value){
		var i,
			list = this.getList(),
			text = [],
			values = {},
			changed = [];

		value = value || [];

		if (typeof value == "string")
			value = value.split(this.config.separator);
		else if(list.config.dataFeed)
			value = this._toMultiValue(value);

		for ( i = 0; i < value.length; i++){
			values[value[i]] = 1;
			if(list.getItem(value[i])){
				if( this._valueHistory)
					this._valueHistory[value[i]] = smdui.copy(list.getItem(value[i]));
				text.push(this.getItemText(value[i]));
			}
		}


		list.data.each(function(item){
			if(item.$checked){
				if(!values[item.id]){
					item.$checked = 0;
					changed.push(item.id);
				}
			}
			else{
				if(values[item.id]){
					item.$checked = 1;
					changed.push(item.id);
				}
			}

		},this,true);

		for( i=0; i < changed.length; i++ ){
			list.refresh(changed[i]);
		}
		this._settings.value = value.length?value.join(this.config.separator):"";
		return text;
	},
	getValue:function(){
		return this._settings.value;
	},
	_preselectMasterOption: function(){
		var node, master;
		if (this._settings.master){
			master = smdui.$$(this._settings.master);
			node = master.getInputNode();
		}
		node = node || this._last_input_target;
		if(node)
			node.focus();
	},
	_toMultiValue: function(value){
		if(value && smdui.isArray(value)){
			var values = [];
			for(var i =0; i < value.length; i++){
				if(value[i].id){
					this._valueHistory[value[i].id] = smdui.copy(value[i]);
					values.push(value[i].id);
				}
				else{
					values.push(value[i]);
				}
			}
			value = values;
		}
		return value;
	}
}, smdui.ui.multisuggest);

smdui.protoUI({
	name:"multicombo",
	$cssName:"text",
	defaults:{
		keepText: true,
		separator:",",
		icon: false,
		iconWidth: 0,
		tagMode: true,
		tagTemplate: function(values){
			return (values.length?values.length+" item(s)":"");
		},
		template:function(obj,common){
			return common._render_value_block(obj, common);
		}
	},
	$init:function(){
		this.$view.className += " smdui_multicombo";

		this.attachEvent("onBeforeRender",function(){
			if(!this._inputHeight)
				this._inputHeight = smdui.skin.$active.inputHeight;
			return true;
		});
		this.attachEvent("onAfterRender", function(){
			this._last_size = null;
		});

		this._renderCount = 0;
	},

	on_click: {
		"smdui_multicombo_delete": function(e,view,node){
			var value;
			if(!this._settings.readonly && node && (value = node.parentNode.getAttribute("optvalue")))
				this._removeValue(value);
			return false;
		}
	},
	_onBlur:function(){
		var value = this.getInputNode().value;
		if(value && this._settings.newValues){
			this._addNewValue(value);
		}

		this._inputValue = "";
		this.refresh();
	},
	_removeValue: function(value){
		var values = this._settings.value;
		if(typeof values == "string")
			values = values.split(this._settings.separator);
		values = smdui.toArray(smdui.copy(values));
		values.remove(value);

		this.setValue(values.join(this._settings.separator));
	},
	_addValue: function(newValue){
		var suggest = smdui.$$(this.config.suggest);
		var list = suggest.getList();
		var item = list.getItem(newValue);

		if(item){
			var values = suggest.getValue();
			if(values && typeof values == "string")
				values = values.split(suggest.config.separator);
			values = smdui.toArray(values||[]);
			if(values.find(newValue)<0){
				values.push(newValue);
				suggest.setValue(values);
				this.setValue(suggest.getValue());
			}
		}
	},

	_addNewValue: function(value){
		var suggest = smdui.$$(this.config.suggest);
		var list = suggest.getList();
		if(!list.exists(value) && value.replace(/^\s+|\s+$/g,'')){
			list.add({id: value, value: value});
		}

		this._addValue(value);
	},
	_suggest_config:function(value){
		var isObj = !smdui.isArray(value) && typeof value == "object" && !value.name,
			suggest = { view:"checksuggest", separator:this.config.separator, buttonText: this.config.buttonText, button: this.config.button },
			combo = this;

		if (this._settings.optionWidth)
			suggest.width = this._settings.optionWidth;

		if (isObj)
			smdui.extend(suggest, value, true);

		var view = smdui.ui(suggest);
		if(!this._settings.optionWidth)
			view.$customWidth = function(node){
				this.config.width = combo._get_input_width(combo._settings);
			};
		view.attachEvent("onBeforeShow",function(node,mode, point){
			if(this._settings.master){
				this.setValue(smdui.$$(this._settings.master).config.value);

				if(smdui.$$(this._settings.master).getInputNode().value){
					this.getList().refresh();
					this._dont_unfilter = true;
				}
				else
					this.getList().filter();

				if(node.tagName && node.tagName.toLowerCase() == "input"){
					smdui.ui.popup.prototype.show.apply(this, [node.parentNode,mode, point]);
					return false;
				}
			}

		});
		var list = view.getList();
		if (typeof value == "string")
			list.load(value);
		else if (!isObj)
			list.parse(value);

		return view;
	},
	_render_value_block:function(obj, common){
		var id, input, inputAlign,inputStyle, inputValue, inputWidth,
			height, html, label, list, message, padding, readOnly,  width,
			bottomLabel = "",
			top =  this._settings.labelPosition == "top";

		id = "x"+smdui.uid();
		width = common._get_input_width(obj);
		inputAlign = obj.inputAlign || "left";

		height = this._inputHeight - 2*smdui.skin.$active.inputPadding -2;

		inputValue = (this._inputValue||"");
		list = "<ul class='smdui_multicombo_listbox' style='line-height:"+height+"px'></ul>";

		inputWidth = Math.min(width,(common._inputWidth||7));

		inputStyle = "width: "+inputWidth+"px;height:"+height+"px;max-width:"+(width-20)+"px";

		readOnly = obj.readonly?" readonly ":"";
		input = "<input id='"+id+"' role='combobox' aria-multiline='true' aria-label='"+smdui.template.escape(obj.label)+"' tabindex='0' type='text' class='smdui_multicombo_input' "+readOnly+" style='"+inputStyle+"' value='"+inputValue+"'/>";
		html = "<div class='smdui_inp_static' onclick='' style='line-height:"+height+"px;width: " + width + "px;  text-align: " + inputAlign + ";height:auto' >"+list+input +"</div>";

		label = common.$renderLabel(obj,id);

		padding = this._settings.awidth - width - smdui.skin.$active.inputPadding*2;
		message = (obj.invalid ? obj.invalidMessage : "") || obj.bottomLabel;
		if (message)
			bottomLabel =  "<div class='smdui_inp_bottom_label' style='width:"+width+"px;margin-left:"+Math.max(padding,smdui.skin.$active.inputPadding)+"px;'>"+message+"</div>";

		if (top)
			return label+"<div class='smdui_el_box' style='width:"+this._settings.awidth+"px; '>"+html+bottomLabel+"</div>";
		else
			return "<div class='smdui_el_box' style='width:"+this._settings.awidth+"px; min-height:"+this._settings.aheight+"px;'>"+label+html+bottomLabel+"</div>";
	},
	_getValueListBox: function(){
		return this._getBox().getElementsByTagName("UL")[0];
	},

	_set_inner_size: function(){
		var popup = this.getPopup();
		if(popup){

			var textArr = (popup ? popup.setValue(this._settings.value) : null);
			if(popup._toMultiValue)
				this._settings.value = popup._toMultiValue(this._settings.value);
			var html = "";
			var listbox = this._getValueListBox();
			var text = textArr && textArr.length;
			if(text){
				var height = this._inputHeight - 2*smdui.skin.$active.inputPadding - 8;
				var values = this._settings.value;
				if(typeof values == "string")
					values = values.split(this._settings.separator);

				if(this._settings.tagMode){
					for(var i=0; i < textArr.length;i++){
						var content = "<span>"+textArr[i]+"</span><span class='smdui_multicombo_delete' role='button' aria-label='"+smdui.i18n.aria.removeItem+"'>x</span>";
						html += "<li class='smdui_multicombo_value' style='line-height:"+height+"px;' optvalue='"+ values[i]+"'>"+content+"</li>";
					}
				}
				else{
					html += "<li class='smdui_multicombo_tag' style='line-height:"+height+"px;'>"+this._settings.tagTemplate(values)+"</li>";
				}

			}
			listbox.innerHTML = html;
			// reset placeholder
			var inp = this.getInputNode();
			if(this._settings.placeholder){
				if(text){
					inp.placeholder = "";
					if(!inp.value && inp.offsetWidth > 20)
						inp.style.width = "20px";
				}
				else if(!inp.value){
					inp.placeholder = this._settings.placeholder;
					inp.style.width = this._get_input_width(this._settings)+"px";
				}
			}

			if(!this._settings.tagMode && listbox.firstChild)
				inp.style.width = this._getMultiComboInputWidth() +"px";
		}
		this._resizeToContent();
	},
	_focusAtEnd: function(inputEl){
		inputEl = inputEl||this.getInputNode();
		if (inputEl){
			if(inputEl.value.length){
				if (inputEl.createTextRange){
					var FieldRange = inputEl.createTextRange();
					FieldRange.moveStart('character',inputEl.value.length);
					FieldRange.collapse();
					FieldRange.select();
				}else if (inputEl.selectionStart || inputEl.selectionStart == '0') {
					var elemLen = inputEl.value.length;
					inputEl.selectionStart = elemLen;
					inputEl.selectionEnd = elemLen;
					inputEl.focus();
				}
			}else{
				inputEl.focus();
			}
		}
	},
	_resizeToContent: function(){
		var top = this._settings.labelPosition == "top";
		var inputDiv = this._getInputDiv();
		var inputHeight = Math.max(inputDiv.offsetHeight+ 2*smdui.skin.$active.inputPadding, this._inputHeight);

		if(top)
			inputHeight += this._labelTopHeight;

		inputHeight += this._settings.bottomPadding ||0;

		var sizes = this.$getSize(0,0);

		if(inputHeight != sizes[2]){
			var cHeight = inputDiv.offsetHeight + (top?this._labelTopHeight:0);

			// workaround for potential rendering loop
			if(cHeight == this._calcHeight)
				this._renderCount++;
			else
				this._renderCount = 0;

			if(this._renderCount > 10)
				return false;

			this._calcHeight = cHeight;

			var topView =this.getTopParentView();
			clearTimeout(topView._template_resize_timer);
			topView._template_resize_timer = smdui.delay(function(){
				this.config.height = this._calcHeight + 2*smdui.skin.$active.inputPadding;
				this.resize();

				if(this._typing){
					this._focusAtEnd(this.getInputNode());
					this._typing = false;
				}
				if(this._enter){
					if(!this._settings.keepText)
						this.getInputNode().value = "";
					else
						this.getInputNode().select();
					this._enter = false;
				}
				if(this.getPopup().isVisible()||this._typing){
					this.getPopup().show(this._getInputDiv());
				}

			}, this);
		}
		if(this._enter){
			this.getInputNode().select();
		}
	},
	_getInputDiv: function(){
		var parentNode = this._getBox();
		var nodes = parentNode.childNodes;
		for(var i=0; i < nodes.length; i++){
			if(nodes[i].className && nodes[i].className.indexOf("smdui_inp_static")!=-1)
				return nodes[i];
		}
		return parentNode;
	},
	getInputNode: function(){
		return this._getBox().getElementsByTagName("INPUT")[0];
	},
	$setValue:function(){
		if (this._rendered_input)
			this._set_inner_size();
	},
	getValue:function(config){
		if(typeof config == "object" && config.options)
			return this._getSelectedOptions();

		var value = this._settings.value;
		if (!value) return "";
		return (typeof value != "string"?value.join(this._settings.separator):value);
	},
	getText:function(){
		var value = this._settings.value;
		if(!value) return "";
		
		if(typeof value == "string")
			value = value.split(this._settings.separator);

		var text = [];
		for(var i = 0; i<value.length; i++)
			text.push(this.getPopup().getItemText(value[i]));
		return text.join(this._settings.separator);
	},
	_getSelectedOptions: function(){
		var i, item, popup,
			options = [],
			value = this._settings.value;

		if (!value) return [];

		if(typeof value == "string")
			value = value.split(this._settings.separator);

		popup = this.getPopup();

		for(i = 0; i < value.length; i++){
			item = popup.getList().getItem(value[i]) || (popup._valueHistory?popup._valueHistory[value[i]]:null);
			if(item)
				options.push(item);
		}

		return options;
	},
	$setSize:function(x,y){
		var config = this._settings;
		if(smdui.ui.view.prototype.$setSize.call(this,x,y)){
			if (!x || !y) return;
			if (config.labelPosition == "top"){
				config.labelWidth = 0;
			}
			this.render();
		}
	},
	_calcInputWidth: function(value){
		var tmp = document.createElement("span");
		tmp.className = "smdui_multicombo_input";
		tmp.style.visibility = "visible";
		tmp.style.height = "0px";
		tmp.innerHTML = value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
		document.body.appendChild(tmp);
		var width = tmp.offsetWidth+10;
		document.body.removeChild(tmp);
		return width;
	},
	_getMultiComboInputWidth: function(){
		var listbox = this._getValueListBox();
		return listbox.offsetWidth - listbox.firstChild.offsetWidth - 17;
	},
	_init_onchange:function(){
		// input focus and focus styling
		smdui._event(this._getBox(),"click",function(){
			this.getInputNode().focus();
		},{bind:this});
		smdui._event(this.getInputNode(),"focus",function(){
			if(this._getBox().className.indexOf("smdui_focused") == -1)
				this._getBox().className += " smdui_focused";

		},{bind:this});
		smdui._event(this.getInputNode(),"blur",function(){
			this._getBox().className = this._getBox().className.replace(" smdui_focused","");
		},{bind:this});

		// need for clear click ("x") in IE
		smdui._event(this.getInputNode(),"input",function(){
			if(!this.getInputNode().value && this._inputValue){
				this.getInputNode().style.width = "20px";
				this._inputWidth = 20;

				this._inputValue = "";
				this._typing = true;

				this.getPopup().show(this._getInputDiv());
				this._resizeToContent();
			}
		},{bind:this});
		// resize
		smdui._event(this.getInputNode(),"keyup",function(e){
			var inp = this.getInputNode();
			var calcWidth, width;

			e = (e||event);
			// to show placeholder
			if(this._settings.placeholder && !this._settings.value && !inp.value)
				width = this._get_input_width(this._settings);
			else{
				width = calcWidth = this._calcInputWidth(inp.value)+10;
				if(!this._settings.tagMode && this._getValueListBox().firstChild)
					width = this._getMultiComboInputWidth();
			}

			inp.style.width = width +"px";

			if(calcWidth!=this._inputWidth){
				if(this._settings.keepText || e.keyCode !=13){
					this._inputValue = inp.value;
				}
				else{
					this._inputValue = false;
				}
				this._typing = true;

				if(this._inputWidth)
					this.getPopup().show(this._getInputDiv());

				this._inputWidth = calcWidth||width;
				this._resizeToContent();
			}
			else if(this._windowHeight != this.getPopup().$height){
				this.getPopup().show(this._getInputDiv());
			}

			if(inp.value.indexOf(this._settings.separator) > -1 && this._settings.tagMode){
				var newValue = inp.value.replace(this._settings.separator, '');
				if (newValue){
					var newId = this.getPopup().getItemId(newValue);
					if (newId)
						this._addValue(newId);
					else if (this._settings.newValues)
						this._addNewValue(newValue);
				}

				if(this._settings.keepText){
					this._inputValue = newValue;
					inp.value = newValue;
					this._enter = true;
					this._typing = true;
					this._resizeToContent();
				} else{
					inp.value = "";
				}
			}
		},{bind:this});

		// remove the last value on Backspace click
		smdui._event(this.getInputNode(),"keydown",function(e){
			this._enter = false;
			if (this.isVisible()){
				e = (e||event);
				var node = this._getValueListBox().lastChild;
				this._windowHeight = this.getPopup().$height;
				if(e.keyCode == 8 && node){
					if(!this.getInputNode().value && ((new Date()).valueOf() - (this._backspaceTime||0) > 100)){
						this._typing = true;
						this._removeValue(node.getAttribute("optvalue"));
					}
					else{
						this._backspaceTime = (new Date()).valueOf();
					}
				}

				if(e.keyCode == 13 || e.keyCode == 9){
					var input = this.getInputNode();
					var id = "";
					var suggest = smdui.$$(this._settings.suggest);
					var list = suggest.getList();
					// if no selected options

					if(!list.getSelectedId()){
						if (input.value)
							id = suggest.getSuggestion();

						if(this._settings.newValues){
							if(e.keyCode == 13)
								this._enter = true;
							this._addNewValue(input.value);
							if(this._settings.keepText)
								this._inputValue = input.value;
							else
								input.value = "";
						}
						else if(id){
							if(e.keyCode == 9){
								this._typing = false;
								this._inputValue = "";
								this._inputWidth = 10;
								input.value = "";
								this._addValue(id);
							}
							else{
								this._enter = true;
								this._addValue(id);
								if(this._settings.keepText)
									this._inputValue = input.value;
								else
									input.value = "";
							}
						}

					}
					if(e.keyCode == 13){
						this._enter = true;
						this._typing = true;
					}

				}
			}
		},{bind:this});
		smdui.$$(this._settings.suggest).linkInput(this);
	}
}, smdui.ui.richselect);

smdui.protoUI({
	name:"menu",
	_listClassName:"smdui_menu",
	$init:function(config){
		this.data._scheme_init = smdui.bind(function(obj){
			if (obj.disabled)
				this.data.addMark(obj.id, "smdui_disabled", true, 1, true);
		}, this);

		if (config.autowidth){
			this._autowidth_submenu = true;
			delete config.autowidth;
		}

		this.data.attachEvent('onStoreUpdated', smdui.bind(function(){
			this._hide_sub_menu();
		},this));
		this.attachEvent('onMouseMove', this._mouse_move_menu);
		this.attachEvent('onMouseOut',function(){
			if (this._menu_was_activated() && this._settings.openAction == "click") return;
			if (!this._child_menu_active)
				this._hide_sub_menu();
		});
		this.attachEvent('onItemClick', function(id, e, trg){
			var item = this.getItem(id);
			if (item){
				if (item.$template) return;

				var parent = this.getTopMenu();

				//ignore disabled items
				if (!this.data.getMark(id, "smdui_disabled")){
					if (!parent.callEvent("onMenuItemClick", [id, e, trg])){
						e.showpopup = true;
						return;
					}

					if (this != parent)
						parent._call_onclick(id,e,trg);

					//click on group - do not close submenus
					if (!item.submenu){
						parent._hide_sub_menu(true);
						if (parent._hide_on_item_click)
							parent.hide();
					} else {
						if ((this === parent || smdui.env.touch ) && parent._settings.openAction == "click"){
							this._mouse_move_activation(id, trg);
						}

						//do not close popups when clicking on menu folder
						e.showpopup = true;
					}
				}
			}
		});

		this.attachEvent("onKeyPress", function(code, e){
			if(code === 9) this.getTopMenu()._hide_sub_menu();
			else if(code === 13 || code === 32){
				var sel = this.getSelectedId(), node;
				if(sel)
					node = this.getItemNode(sel);
				if(node)
					smdui.html.triggerEvent(node, "MouseEvents", "click");
			}

		});

		this.data.attachEvent("onClearAll", function(){
			this._hidden_items = [];
		});
		this.data._hidden_items = [];

		this._viewobj.setAttribute("role", "menubar");
	},
	sizeToContent:function(){
		if (this._settings.layout == "y"){
			var texts = [];
			var isSubmenu = false;
			this.data.each(function(obj){
				texts.push(this._toHTML(obj));
				if(obj.submenu)
					isSubmenu = true;
			}, this);
			// text width + padding + borders+ arrow
			this.config.width = smdui.html.getTextSize(texts, this.$view.className).width+8*2+2+(isSubmenu?15:0);
			this.resize();
		} else smdui.assert(false, "sizeToContent will work for vertical menu only");
	},
	getTopMenu:function(){
		var parent = this;
		while (parent._parent_menu)
			parent = smdui.$$(parent._parent_menu);
		return parent;
	},
	_auto_height_calc:function(count){
		if (this._settings.autoheight) count = this.count();

		var height = 0;
		for (var i=0; i<count; i++){
			var item = this.data.pull[this.data.order[i]];
			if (item && item.$template == "Separator")
				height+=4;
			else
				height+=this.type.height;
		}
		return height;
	},
	on_mouse_move:{},
	type:{
		css:"menu",
		width:"auto",
		aria:function(obj, common, marks){
			return 'role="menuitem"'+(marks && marks.smdui_selected?' aria-selected="true" tabindex="0"':'tabindex="-1"')+(obj.submenu?'aria-haspopup="true"':'')+(marks && marks.smdui_disabled?' aria-disabled="true"':'');
		},
		templateStart:function(obj, common, mark){
			if (obj.$template === "Separator" || obj.$template === "Spacer"){
				return '<div smdui_l_id="#id#" role="separator" tabindex="-1" class="smdui_context_'+obj.$template.toLowerCase()+'">';
			}
			var link = (obj.href?" href='"+obj.href+"' ":"")+(obj.target?" target='"+obj.target+"' ":"");
			return smdui.ui.list.prototype.type.templateStart(obj,common,mark).replace(/^<div/,"<a "+link)+((obj.submenu && common.subsign)?"<div class='smdui_submenu_icon'></div>":"");
		},
		templateEnd: function(obj, common, mark){
			return (obj.$template === "Separator" || obj.$template === "Spacer")?"</div>":"</a>";
		},
		templateSeparator:smdui.template("<div class='sep_line'></div>"),
		templateSpacer:smdui.template("<div></div>")
	},
	getMenu: function(id){
		if (!this.data.pull[id]){
			for (var subid in this.data.pull){
				var obj = this.getItem(subid);
				if (obj.submenu){
					var search = this._get_submenu(obj).getMenu(id);
					if (search) return search;
				}
			}
		} else return this;
	},
	getSubMenu:function(id){
		var menu = this.getMenu(id);
		var obj = menu.getItem(id);
		return (obj.submenu?menu._get_submenu(obj):null);
	},
	getMenuItem:function(id){
		return this.getMenu(id).getItem(id);
	},
	_get_submenu:function(data){
		var sub  = smdui.$$(data.submenu);
		if (!sub){
			data.submenu = this._create_sub_menu(data);
			sub = smdui.$$(data.submenu);
		}
		return sub;
	},
	_mouse_move_menu:function(id, e, target){
		if (!this._menu_was_activated())
			return;

		this._mouse_move_activation(id, target);
	},
	_menu_was_activated:function(){
		var top = this.getTopMenu();
		if (top._settings.openAction == "click"){
			if (smdui.env.touch) return false;
			var sub = top._open_sub_menu;
			if (sub && smdui.$$(sub).isVisible())
				return true;
			return false;
		}
		return true;
	},
	_mouse_move_activation:function(id, target){
		var data = this.getItem(id);
		if (!data) return;
		
		//clear flag of submenu usage
		this._child_menu_active = null;

		//hide previously opened sub-menu
		if (this._open_sub_menu && data.submenu != this._open_sub_menu)
			this._hide_sub_menu(true);

		//show submenu
		if (data.submenu&&!this.config.hidden){

			var sub  = this._get_submenu(data);
			if(this.data.getMark(id,"smdui_disabled"))
				return;
			sub.show(target,{ pos:this._settings.subMenuPos });

			sub._parent_menu = this._settings.id;

			this._open_sub_menu = data.submenu;
		}
	},
	disableItem:function(id){
		this.getMenu(id).addCss(id, "smdui_disabled");
	},
	enableItem:function(id){
		this.getMenu(id).removeCss(id, "smdui_disabled");
	},
	_set_item_hidden:function(id, state){
		var menu = this.data;
		if (menu._hidden_items[id] != state){
			menu._hidden_items[id] = state;
			menu.filter(function(obj){
				return !menu._hidden_items[obj.id];
			});
			this.resize();		
		}
	},
	hideItem:function(id){
		var menu = this.getMenu(id);
		if (menu) menu._set_item_hidden(id, true);
	},
	showItem:function(id){
		var menu = this.getMenu(id);
		if (menu){
			menu._set_item_hidden(id, false);
			return smdui.ui.list.prototype.showItem.call(menu, id);
		}
	},
	_hide_sub_menu : function(mode){
		if (this._open_sub_menu){
			//recursive sub-closing
			var sub = smdui.$$(this._open_sub_menu);
			if (sub._hide_sub_menu)	//custom context may not have submenu
				sub._hide_sub_menu(mode);
			if (mode || !sub._show_on_mouse_out){
				sub.hide();
				this._open_sub_menu = null;
			}
		}
	},
	_create_sub_menu : function(data){
		var listConfig = {
			view:"submenu",
			data:data.submenu
		};

		var settings = this.getTopMenu()._settings.submenuConfig;
		if (settings)
			smdui.extend(listConfig, settings, true);

		var parentData = this.getMenuItem(data.id);
		if(parentData && parentData.config)
			smdui.extend(listConfig, parentData.config, true);

		var menu = smdui.ui(listConfig);
		menu._parent_menu = this;
		return menu._settings.id;
	},
	_skip_item:function(id, prev, mode){
		var item = this.getItem(id);
		if(item.$template == "Separator" || item.$template == "Spacer" || this.data.getMark(id, "smdui_disabled")){
            var index = this.getIndexById(id)+(mode == "up"?-1:1);
            id = (index>=0)?this.getIdByIndex(index):null;
            return id? this._skip_item(id, prev, mode) : prev;
        }
        else
			return id;
	},
	$skin:function(){
		smdui.ui.list.prototype.$skin.call(this);
		this.type.height = smdui.skin.$active.menuHeight;
	},
	defaults:{
		scroll:"",
		layout:"x",
		mouseEventDelay:100,
		subMenuPos:"bottom"
	}
}, smdui.ui.list);


smdui.protoUI({
	name:"submenu",
	$init:function(){
		this._body_cell = smdui.clone(this._dummy_cell_interface);
		this._body_cell._view = this;

		this.attachEvent('onMouseOut',function(){
			if (this.getTopMenu()._settings.openAction == "click") 
				return;
			if (!this._child_menu_active && !this._show_on_mouse_out)
				this.hide();
		});

		//inform parent that focus is still in menu
		this.attachEvent('onMouseMoving',function(){
			if (this._parent_menu)
				smdui.$$(this._parent_menu)._child_menu_active = true;
		});
		this.attachEvent("onBeforeShow", function(){
			if (this.getTopMenu()._autowidth_submenu && this.sizeToContent && !this.isVisible())
				this.sizeToContent();
		});

		this._dataobj.setAttribute("role", "menu");
	},
	$skin:function(){
		smdui.ui.menu.prototype.$skin.call(this);
		smdui.ui.popup.prototype.$skin.call(this);

		this.type.height = smdui.skin.$active.menuHeight;
	},
	_dummy_cell_interface : {
		$getSize:function(dx, dy){
			//we saving height and width, as list can hardcode new values
			var h = this._view._settings.height*1;
			var w = this._view._settings.width*1;
			var size = smdui.ui.menu.prototype.$getSize.call(this._view, dx, dy);
			//restoring
			this._view._settings.height = h;
			this._view._settings.width = w;
			return size;
		},
		$setSize:function(x,y){
			if (this._view._settings.scroll)
				this._view._bodyobj.style.height = y+"px";
		},
		destructor:function(){ this._view = null; }
	},
	//ignore body element
	body_setter:function(){
	},
	getChildViews:function(){ return []; },
	defaults:{
		width:150,
		subMenuPos:"right",
		layout:"y",
		autoheight:true
	},
	type:{
		height: smdui.skin.menuHeight,
		subsign:true
	}
}, smdui.ui.menu, smdui.ui.popup);




smdui.ContextHelper = {
	defaults:{
		padding:"4",
		hidden:true
	},
	body_setter:function(value){
		value = smdui.ui.window.prototype.body_setter.call(this, value);
		this._body_cell._viewobj.style.borderWidth = "0px";
		return value;
	},
	attachTo:function(obj){
		smdui.assert(obj, "Invalid target for Context::attach");
		var id;
		if (obj.on_context)
			id = obj.attachEvent("onAfterContextMenu", smdui.bind(this._show_at_ui, this));
		else 
			id = smdui.event(obj, "contextmenu", this._show_at_node, {bind:this});

		this.attachEvent("onDestruct", function(){
			if (obj.detachEvent)
				obj.detachEvent(id);
			else
				smdui.eventRemove(id);
			obj = null;			
		});
	},
	getContext:function(){
		return this._area;
	},
	setContext:function(area){
		this._area = area;
	},
	_show_at_node:function(e){
		this._area = smdui.toNode(e||event);
		return this._show_at(e);
	},
	_show_at_ui:function(id, e, trg){
		this._area = { obj:smdui.$$(e), id:id };
		return this._show_at(e);
	},
	_show_at:function(e){
		var result = this.show(e, null, true);
		if (result === false) return result;

		//event forced to close other popups|context menus
		smdui.callEvent("onClick", []);		
		return smdui.html.preventEvent(e);
	},
	_show_on_mouse_out:true,
	master_setter:function(value){
		this.attachTo(value);
		return null;
	}
};
smdui.protoUI({
	name:"context"
}, smdui.ContextHelper, smdui.ui.popup); 

smdui.protoUI({
	name:"contextmenu",
	_hide_on_item_click:true,
	$init: function(config){
		if(config.submenuConfig)
			smdui.extend(config,config.submenuConfig);
	}
}, smdui.ContextHelper, smdui.ui.submenu);

/*

*/

smdui.protoUI({
	name:"tabbar",
	$init:function(){
		this.attachEvent("onKeyPress", this._onKeyPress);
	},
	$skin:function(){
		var skin = smdui.skin.$active;
		var defaults = this.defaults;

		defaults.topOffset = skin.tabTopOffset||0;
		defaults.tabOffset = (typeof skin.tabOffset != "undefined"?skin.tabOffset:10);
		defaults.bottomOffset = skin.tabBottomOffset||0;
		defaults.height = skin.tabbarHeight;

		defaults.tabMargin = skin.tabMargin;
		defaults.inputPadding = skin.inputPadding;
		defaults.tabMinWidth = skin.tabMinWidth||100;
		defaults.tabMoreWidth = skin.tabMoreWidth||40;
	},
	_getTabbarSizes: function(){

		var config = this._settings,
			i, len,
			tabs = this._tabs||config.options,
			totalWidth = this._input_width - config.tabOffset*2,
			limitWidth = config.optionWidth||config.tabMinWidth;

		len = tabs.length;

		if(config.tabMinWidth && totalWidth/len < limitWidth){
			return { max: (parseInt(totalWidth/limitWidth,10)||1)};
		}


		if(!config.optionWidth){
			for(i=0;i< len; i++){
				if(tabs[i].width){
					totalWidth -= tabs[i].width+(!i&&!config .type?config.tabMargin:0);
					len--;
				}
			}
		}

		return {width: (len?totalWidth/len:config.tabMinWidth)};
	},
	_init_popup: function(){
		var obj = this._settings;
		if (!obj.tabbarPopup){
			var popupConfig = {
				view: "popup",
				width: (obj.popupWidth||200),
				body:{
					view: "list",
					borderless: true,
					select: true,
					css: "smdui_tab_list",
					autoheight: true, yCount:obj.yCount,
					type:{
						template: obj.popupTemplate
					}
				}
			};
			var view = smdui.ui(popupConfig);
			view.getBody().attachEvent("onBeforeSelect",smdui.bind(function(id){
				if (id && this.callEvent("onBeforeTabClick", [id])){
						this.setValue(id);
					smdui.$$(this._settings.tabbarPopup).hide();
					this.callEvent("onAfterTabClick", [id]);
					return true;
				}
			},this));

			view.getBody().attachEvent("onAfterSelect", smdui.bind(function(id){
				this.refresh();
			},this));

			obj.tabbarPopup = view._settings.id;
			this._destroy_with_me.push(view);
		}
		this._init_popup = function(){};
	},
	getPopup: function(){
		this._init_popup();
		return smdui.$$(this._settings.tabbarPopup);
	},
	moreTemplate_setter: smdui.template,
	popupTemplate_setter: smdui.template,
	defaults:{
		popupWidth: 200,
		popupTemplate: "#value#",
		yCount: 7,
		moreTemplate: '<span class="smdui_icon fa-ellipsis-h"></span>',
		template:function(obj,common) {
			var contentWidth, html, i, leafWidth, resultHTML, style, sum, tabs, verticalOffset, width;

			common._tabs = tabs = common._filterOptions(obj.options);

			if (!tabs.length){
				html = "<div class='smdui_tab_filler' style='width:"+common._input_width+"px; border-right:0px;'></div>";
			} else {
				common._check_options(tabs);
				if (!obj.value && tabs.length)
					obj.value = tabs[0].id;

				html = "";
				if (obj.tabOffset)
					html += "<div class='smdui_tab_filler' style='width:"+obj.tabOffset+"px;'>&nbsp;</div>";
				contentWidth = common._input_width - obj.tabOffset*2-(!obj.type?(obj.tabMargin)*(tabs.length-1):0);
				verticalOffset = obj.topOffset+obj.bottomOffset;

				var sizes = common._getTabbarSizes();

				if(sizes.max && sizes.max < tabs.length){
					//we need popup
					var popup = common.getPopup();
					popup.hide();

					var list = (popup.getBody()||null);
					if(list){
						if(sizes.max){
							var found = false;
							for( i = 0; i < tabs.length && !found; i++)
								if(tabs[i].id== obj.value){
									found = true;
									if((i+1) > sizes.max){
										var selectedTab =  tabs.splice(i, 1);
										var displayTabs = tabs.splice(0, sizes.max-1).concat(selectedTab);
										tabs = displayTabs.concat(tabs);
									}
								}
							list.clearAll();
							list.parse(tabs.slice(sizes.max));
						}
						else{
							list.clearAll();
						}
					}
				} else if (common._settings.tabbarPopup)
					smdui.$$(common._settings.tabbarPopup).hide();

				sum = obj.tabOffset;
				var lastTab = false;
				for(i = 0; (i<tabs.length) && !lastTab; i++) {

					// tab width
					if(sizes && sizes.max){
						if(sizes.max == (i + 1)){
							lastTab = true;
						}
						contentWidth = common._input_width - obj.tabOffset*2-(!obj.type&&(sizes.max>1)?(obj.tabMargin)*(sizes.max-1):0);
						width = (contentWidth - obj.tabMoreWidth)/sizes.max ;
					}
					else
						width = sizes.width;

					width = (tabs[i].width||obj.optionWidth||width);

					sum += width + (i&&!obj.type?obj.tabMargin:0);

					if(obj.tabMargin>0&&i&&!obj.type)
					   html += "<div class='smdui_tab_filler' style='width:"+obj.tabMargin+"px;'></div>";

					// tab innerHTML
					html += common._getTabHTML(tabs[i],width);


					if(lastTab){
						html += '<div role="button" tabindex="0" aria-label="'+smdui.i18n.aria.showTabs+'" class="smdui_tab_more_icon" style="width:'+obj.tabMoreWidth+'px;">'+obj.moreTemplate(obj,common)+'</div>';
						sum += obj.tabMoreWidth;
					}
				}


				leafWidth = common._content_width - sum;

				if (leafWidth>0 && !obj.type)
					html += "<div class='smdui_tab_filler' style='width:"+leafWidth+"px;'>&nbsp;</div>";
			}

			resultHTML = "";

			// consider top and bottom offset in tabs height (top tabbar)
			style = (verticalOffset&& !obj.type)?"height:"+(common._content_height-verticalOffset)+"px":"";

			//space above tabs (top tabbar)
			if(obj.topOffset && !obj.type)
				resultHTML += "<div class='smdui_before_all_tabs' style='width:100%;height:"+obj.topOffset+"px'></div>";

			// tabs html
			resultHTML +=  "<div style='"+style+"' role='tablist' class='smdui_all_tabs "+(obj.type?("smduitype_"+obj.type):"")+"'>"+html+"</div>";

			//space below to tabs (top tabbar)
			if(obj.bottomOffset && !obj.type)
				resultHTML += "<div class='smdui_after_all_tabs' style='width:100%;height:"+obj.bottomOffset+"px'></div>";

			return resultHTML;
		}
	},
	_getInputNode:function(){
		return this.$view.querySelectorAll(".smdui_item_tab");
	},
	_getTabHTML: function(tab,width){
		var	html,
			className = '',
			config = this.config;

		if(tab.id== config.value)
			className=" smdui_selected";

		if (tab.css)
			className+=" "+tab.css;

		width = (tab.width||width);

		html ='<div class="smdui_item_tab'+className+'" button_id="'+tab.id+'" role="tab" aria-selected="'+(tab.id== config.value?"true":"false")+'" tabindex="'+(tab.id== config.value?"0":"-1")+'" style="width:'+width+'px;">';

		// a tab title
		if(this._tabTemplate){
			var calcHeight = this._content_height- config.inputPadding*2 - 2;
			var height = this._content_height - 2;
			var temp = smdui.extend({ cheight: calcHeight, aheight:height }, tab);
			html+= this._tabTemplate(temp);
		}
		else {
			var icon = tab.icon?("<span class='smdui_icon fa-"+tab.icon+"'></span> "):"";
			html+=icon + tab.value;
		}

		if (tab.close || config.close)
			html+="<span role='button' tabindex='0' aria-label='"+smdui.i18n.aria.closeTab+"' class='smdui_tab_close smdui_icon fa-times'></span>";

		html+="</div>";
		return html;
	},
	_types:{
		image:"<div class='smdui_img_btn_top' style='height:#cheight#px;background-image:url(#image#);'><div class='smdui_img_btn_text'>#value#</div></div>",
		icon:"<div class='smdui_img_btn' style='line-height:#cheight#px;height:#cheight#px;'><span class='smdui_icon_btn fa-#icon#' style='max-width:#cheight#px;max-height:#cheight#px;'></span>#value#</div>",
		iconTop:"<div class='smdui_img_btn_top' style='height:#cheight#px;width:100%;top:0px;text-align:center;'><span class='smdui_icon fa-#icon#'></span><div class='smdui_img_btn_text'>#value#</div></div>"
	},
	type_setter:function(value){
		this._settings.tabOffset = 0;
		if (this._types[value])
			this._tabTemplate = smdui.template(this._types[value]);
		return value;
	}
}, smdui.ui.segmented);

smdui.protoUI({
	name:"tabview",
	defaults:{
		type:"clean"
	},
	setValue:function(val){
		this._cells[0].setValue(val);
	},
	getValue:function(){
		return this._cells[0].getValue();
	},
	getTabbar:function(){
		return this._cells[0];
	},
	getMultiview:function(){
		return this._cells[1];
	},
	addView:function(obj){
		var id = obj.body.id = obj.body.id || smdui.uid();

		this.getMultiview().addView(obj.body);

		obj.id = obj.body.id;
		obj.value = obj.header;
		delete obj.body;
		delete obj.header;

		var t = this.getTabbar();
		t.addOption(obj);

		return id;
	},
	removeView:function(id){
		var t = this.getTabbar();
		t.removeOption(id);
		t.refresh();
	},
	$init:function(config){
		this.$ready.push(this._init_tabview_handlers);

		var cells = config.cells;
		var tabs = [];

		smdui.assert(cells && cells.length, "tabview must have cells collection");

		for (var i = cells.length - 1; i >= 0; i--){
			var view = cells[i].body||cells[i];
			if (!view.id) view.id = "view"+smdui.uid();
			tabs[i] = { value:cells[i].header, id:view.id, close:cells[i].close, width:cells[i].width, hidden:  !!cells[i].hidden};
			cells[i] = view;
		}

		var tabbar = { view:"tabbar", multiview:true };
		var mview = { view:"multiview", cells:cells, animate:(!!config.animate) };

		if (config.value)
			tabbar.value = config.value;

		if (config.tabbar)
			smdui.extend(tabbar, config.tabbar, true);
		if (config.multiview)
			smdui.extend(mview, config.multiview, true);
		
		tabbar.options = tabbar.options || tabs;

		config.rows = [
			tabbar, mview
		];

		delete config.cells;
		delete config.tabs;
	},
	_init_tabview_handlers:function(){
		this.getTabbar().attachEvent("onOptionRemove", function(id){
			var view = smdui.$$(id);
			if (view)
				view.destructor();
		});
	}
}, smdui.ui.layout);

smdui.protoUI({
	name:"fieldset",
	defaults:{
		borderless:true,
		$cssName:"smdui_fieldset",
		paddingX: 18,
		paddingY: 30
	},
	$init:function(obj){
		smdui.assert(obj.body, "fieldset must have not-empty body");

		this._viewobj.className += " "+this.defaults.$cssName;
		this._viewobj.innerHTML =  "<fieldset><legend></legend><div></div></fieldset>";
	},
	label_setter:function(value){
		this._viewobj.firstChild.childNodes[0].innerHTML = value;
		return value;
	},
	getChildViews:function(){
		return [this._body_view];
	},
	body_setter:function(config){
		this._body_view = smdui.ui(config, this._viewobj.firstChild.childNodes[1]);
		this._body_view._parent_cell = this;
		return config;
	},
	getBody:function(){
		return this._body_view;
	},
	resizeChildren:function(){
		var x = this.$width - this._settings.paddingX;
		var y = this.$height - this._settings.paddingY;
		var sizes=this._body_view.$getSize(0,0);

		//minWidth
		if (sizes[0]>x) x = sizes[0];
		//minHeight
		if (sizes[2]>y) y = sizes[2];

		this._body_view.$setSize(x,y);
		this.resize();
	},
	$getSize:function(x, y){
		smdui.debug_size_box_start(this, true);

		x += this._settings.paddingX;
		y += this._settings.paddingY;
		
		var t = this._body_view.$getSize(x, y);
		var s = this._last_body_size = smdui.ui.view.prototype.$getSize.call(this, x, y);

		//inner content minWidth > outer
		if (s[0] < t[0]) s[0] = t[0];
		if (s[2] < t[2]) s[2] = t[2];
		//inner content maxWidth < outer
		if (s[1] > t[1]) s[1] = t[1];
		if (s[3] > t[3]) s[3] = t[3];

		smdui.debug_size_box_end(this, s);
		return s;
	},
	$setSize:function(x,y){
		if (smdui.ui.view.prototype.$setSize.call(this, x,y)){
			x = Math.min(this._last_body_size[1], x);
			y = Math.min(this._last_body_size[3], y);
			this._body_view.$setSize(x - this._settings.paddingX, y - this._settings.paddingY);
		}
	}
}, smdui.ui.view);
smdui.protoUI({
	name:"forminput",
	defaults:{
		$cssName:"smdui_forminput",
		labelWidth: 80,
		labelAlign : "left"
	},
	setValue:function(value){
		this._body_view.setValue(value);
	},
	focus:function(){
		this._body_view.focus();
	},
	getValue:function(){
		return this._body_view.getValue();
	},
	value_setter:function(value){
		this.setValue(value);
	},
	getBody:function(){
		return this._body_view;
	},
	$skin:function(){
		this._inputPadding = smdui.skin.$active.inputPadding;
		this._inputSpacing = smdui.skin.$active.inputSpacing;
	},
	$init:function(obj){
		this.$ready.push(function(){
			var label = this._viewobj.firstChild.childNodes[0];
			label.style.width = this._settings.paddingX+"px";
			label.style.textAlign = this._settings.labelAlign;
			if (!this._settings.labelWidth)
				label.style.display = "none";
		});

		var lw = smdui.isUndefined(obj.labelWidth) ? this.defaults.labelWidth : obj.labelWidth;
		obj.paddingX = lw - this._inputPadding*2 + this._inputSpacing* 2;
	},
	setBottomText: function(text) {
		var config = this._settings;
		if (typeof text != "undefined"){
			if (config.bottomLabel == text) return;
			config.bottomLabel = text;
		}
		var message = (config.invalid ? config.invalidMessage : "") || config.bottomLabel;
		if(this._invalidMessage) {
			smdui.html.remove(this._invalidMessage);
		}
		if(message) {
			this.$view.style.position = "relative";
			this._invalidMessage = smdui.html.create("div", { "class":"smdui_inp_bottom_label", role:config.invalid?'alert':"", "aria-relevant":'all', style:"position:absolute; bottom:0px; padding:2px; background: white; left:"+this._settings.labelWidth+"px; " }, message);
			this._viewobj.appendChild(this._invalidMessage);
		}
	}
}, smdui.ui.fieldset);


smdui.protoUI({
	name: "dbllist",
	defaults:{
		borderless:true
	},
	$init: function(config) {
		this._moved = {};
		this._inRight = smdui.bind(function(obj){ return this._moved[obj.id]; }, this);
		this._inLeft = smdui.bind(function(obj){ return !this._moved[obj.id]; }, this);
	
		this.$view.className += " smdui_dbllist";
		this.$ready.unshift(this._setLayout);
	},
	$onLoad:function(data, driver){
		this._updateAndResize(function(){
			this.$$("left").data.driver = driver;
			this.$$("left").parse(data);
			this.$$("right").data.driver = driver;
			this.$$("right").parse(data);
		});

		this._refresh();
	},
	_getButtons:function(){
		if (this._settings.buttons === false)
			return { width: 10 };

		var i18n = smdui.i18n.dbllist;
		var buttons = [
			this._getButton("deselect_all", i18n.deselectAll),
			this._getButton("select_all", i18n.selectAll),
			this._getButton("deselect_one", i18n.deselectOne),
			this._getButton("select_one", i18n.selectOne)
		];


		var buttons = { width:120, template:buttons.join(""), onClick:{
			dbllist_button:function(e, id, trg){
				 this.getTopParentView()._update_list(trg.getAttribute("action"));
			}
		}};
		if (this._settings.buttons)
			buttons.template = this._settings.buttons;

		return buttons;
	},
	_getButton: function(action, label){
		return "<button class='dbllist_button' action='"+action+"'>"+label+"</button>";
	},
	_getList: function(id, action, label, bottom){
		var list = {
			view: "list",
			select: "multiselect",
			multiselect: "touch",
			id: id,
			action: action,
			drag: true,
			type:{
				margin:3,
				id:id
			},
			on: {
				onBeforeDrop: function(context) {
					var source = context.from;
					var target = context.to;
					var top = source.getTopParentView();

					if (top === this.getTopParentView()) {
						var mode = (target._settings.action != "select_one");
						top.select(context.source, mode);
						top._refresh();
					}
					return false;
				},
				onItemDblClick: function(){
					return this.getTopParentView()._update_list(this.config.action);
				}
			}
		};

		if (this._settings.list)
			smdui.extend(list, this._settings.list, true);

		if (label)
			list = { rows:[{ view:"label", label:label }, list] };
		if (bottom)
			return { rows:[list, { view:"label", height:20, label:bottom, css:"bottom_label" }] };
		return list;
	},
	_setLayout: function() {
		var cols = [{
			margin: 10, type:"clean",
			cols: [
				this._getList("left", "select_one", this._settings.labelLeft, this._settings.labelBottomLeft),
				this._getButtons(),
				this._getList("right", "deselect_one", this._settings.labelRight, this._settings.labelBottomRight)
			]
		}];

		this.cols_setter(cols);
	},
	_update_list: function(action) {
		var top = this.getTopParentView();
		var id = null;
		var mode = false;

		if (action === "select_all"){
			id = top.$$("left").data.order;
			mode = true;
		} else if (action === "select_one"){
			id = top.$$("left").getSelectedId(true);
			mode = true;
		} else if (action === "deselect_all"){
			id = top.$$("right").data.order;
			mode = false;
		} else if (action === "deselect_one"){
			id = top.$$("right").getSelectedId(true);
			mode = false;
		}

		top.select(id, mode);
	},
	select:function(id, mode){
		var i;
		if (typeof id !== "object") id = [id];

		if (mode){
			for (i = 0; i < id.length; i++)
				this._moved[id[i]] = true;
		} else {
			for (i = 0; i < id.length; i++)
				delete this._moved[id[i]];
		}
		this.callEvent("onChange", []);
		this._refresh();
	},
	_updateAndResize:function(handler, size){
		smdui.ui.$freeze = true;
		handler.call(this);
		smdui.ui.$freeze = false;

		if (size && (this.$$("left")._settings.autoheight || this.$$("right")._settings.autoheight))
			this.resize();
	},
	_refresh: function() {
		var left = this.$$("left");
		var right = this.$$("right");

		if (left)
			this._updateAndResize(function(){
				left.filter(this._inLeft);
				right.filter(this._inRight);
			}, true);
	},
	focus:function(){
		smdui.UIManager.setFocus(this);
	},
	value_setter:function(val){
		this.setValue(val);
	},
	setValue: function(value) {
		this._moved = {};
		if (typeof value !== "object")
			value = value.toString().split(",");
		for (var i = 0; i < value.length; i++)
			this._moved[value[i]] = true;

		
		this._refresh();
	},
	getValue: function() {
		var value = [];
		for (var key in this._moved)
			value.push(key);

		return value.join(",");
	}
}, smdui.AtomDataLoader, smdui.IdSpace, smdui.ui.layout);

smdui.i18n.dbllist = {
	selectAll : "<span class='smdui_icon fa-angle-double-right'></span>",
	selectOne : "<span class='smdui_icon fa-angle-right'></span>",
	deselectAll : "<span class='smdui_icon fa-angle-double-left'></span>",
	deselectOne : "<span class='smdui_icon fa-angle-left'></span>",
};




(function(){

	function _tagname(el) {
		if (!el.tagName) return null;
		return el.tagName.toLowerCase();
	}
	function _attribute(el, name) {
		if (!el.getAttribute) return null;
		var attr = el.getAttribute(name);
		return attr ? attr.toLowerCase() : null;
	}
	function _get_html_value() {
		var tagname = _tagname(this);
		if (_get_value[tagname])
			return _get_value[tagname](this);
		return _get_value.other(this);
	}

	var _get_value = {
		radio: function(el){
			for (var i = 0; i < el.length; i++)
				if (el[i].checked) return el[i].value;
			return "";
		},
		input: function(el) {
			var type = _attribute(el, 'type');
			if (type === 'checkbox')
				return el.checked;			
			return el.value;
		},
		textarea: function(el) {
			return el.value;
		},
		select: function(el) {
			var index = el.selectedIndex;
			return el.options[index].value;
		},
		other: function(el) {
			return el.innerHTML;
		}
	};

	function  _set_html_value(value) {
		var tagname = _tagname(this);
		if (_set_value[tagname])
			return _set_value[tagname]( this, value);
		return _set_value.other( this, value);
	}

	var _set_value = {
		radio:function(el, value){
			for (var i = 0; i < el.length; i++)
				el[i].checked = (el[i].value == value);
		},
		input: function(el, value) {
			var type = _attribute(el, 'type');
			if (type === 'checkbox')
				el.checked = (value) ? true : false;
			else
				el.value = value;
		},
		textarea: function(el, value) {
			el.value = value;
		},
		select: function(el, value) {
            //select first option if no provided and if possible
			el.value = value?value:el.firstElementChild.value||value;
		},
		other: function(el, value) {
			el.innerHTML = value;
		}
	};


smdui.protoUI({
	name:"htmlform",
	$init: function(config) {
		this.elements = {};
		this._default_values  = false;

		if (config.content && (config.container == config.content || !config.container && config.content == document.body))
			this._copy_inner_content = true;
	},
	content_setter:function(content){
		content = smdui.toNode(content);
		if (this._copy_inner_content){
			while (content.childNodes.length > 1)
				this._viewobj.childNodes[0].appendChild(content.childNodes[0]);
		} else {
			this._viewobj.childNodes[0].appendChild(content);
		}
		this._parse_inputs();
		return true;
	},
	render:function(){
		smdui.ui.template.prototype.render.apply(this, arguments);
		this._parse_inputs();
	},
	_parse_inputs: function() {
		var inputs = this._viewobj.querySelectorAll("[name]");
		this.elements = {};


		for (var i=0; i<inputs.length; i++){
			var el = inputs[i];
			var name = _attribute(el, "name");
			if (name){
				var tag = _tagname(el) === "button";
				var type = _attribute(el, "type");

				var cant_clear = tag || type === "button" || type === "submit";

				if (type === "radio"){
					var stack = this.elements[name] || [];
					stack.tagName = "radio";
					stack.push(el);
					el = stack;
				}

				this.elements[name] = el;

				el.getValue =  _get_html_value;
				el.setValue =  _set_html_value;
				el._allowsClear = !cant_clear;
				el._settings =  { defaultValue : el.getValue() };
			}
		}

		return this.elements;
	},
	_mark_invalid:function(id,obj){
		this._clear_invalid(id,obj);
		var el = this._viewobj.querySelector('[name="' + id + '"]');
		if (el) smdui.html.addCss(el, "invalid");
	},
	_clear_invalid:function(id,obj){
		var el = this._viewobj.querySelector('[name="' + id + '"]');
		if (el) smdui.html.removeCss(el, "invalid");
	}

}, smdui.ui.template, smdui.Values);

})();
(function(){
	var google, script;
	smdui.protoUI({
		name:"google-map",
		$init:function(config){
			this.$view.innerHTML = "<div class='smdui_map_content' style='width:100%;height:100%'></div>";
			this._contentobj = this.$view.firstChild;
			this._waitMap = smdui.promise.defer();

			this.data.provideApi(this, true);
			this.$ready.push(this.render);
		},
		getMap:function(waitMap){
			return waitMap?this._waitMap:this._map;
		},
		_getCallBack:function(prev){
			return smdui.bind(function(){
				if (typeof prev === "function") prev();

				google = google || window.google;
				this._initMap.call(this);
			}, this);
		},
		render:function(){
			if(typeof window.google=="undefined"||typeof window.google.maps=="undefined"){
				if(!script){
					script = document.createElement("script");
					script.type = "text/javascript";

					var config = this._settings;
					var src = config.src || "//maps.google.com/maps/api/js";
					src += (src.indexOf("?")===-1 ? "?" :"&");
					
					if (config.key)
						src += "&key="+config.key;
					if (config.libraries)
						src += "&libraries="+config.libraries;

					script.src = src;
					document.getElementsByTagName("head")[0].appendChild(script);
				}
				script.onload = this._getCallBack(script.onload);
			}
			else //there's a custom link to google api in document head
				(this._getCallBack())();
		},
		_initMap:function(){
			var c = this.config;
			if(this.isVisible(c.id)){
				this._map = new google.maps.Map(this._contentobj, {
					zoom: c.zoom,
					center: new google.maps.LatLng(c.center[0], c.center[1]),
					mapTypeId: google.maps.MapTypeId[c.mapType]
				});
				this._waitMap.resolve(this._map);
			}
		},
		center_setter:function(config){
			if(this._map)
				this._map.setCenter(new google.maps.LatLng(config[0], config[1]));

			return config;
		},
		mapType_setter:function(config){
			/*ROADMAP,SATELLITE,HYBRID,TERRAIN*/
			if(this._map)
				this._map.setMapTypeId(google.maps.MapTypeId[config]);

			return config;
		},
		zoom_setter:function(config){
			if(this._map)
				this._map.setZoom(config);
			return config;
		},
		layerType_setter:function(config){
			if(config == "heatmap")
				this.config.libraries = "visualization";
			if(this._layerApi[config]){
				smdui.extend(this, this._layerApi[config], true);
				this.data.attachEvent("onStoreUpdated", smdui.bind(this.drawData, this));
			}

			return config;
		},
		defaults:{
			zoom: 5,
			center:[ 39.5, -98.5 ],
			mapType: "ROADMAP",
			layerType:"marker"
		},
		$setSize:function(){
			smdui.ui.view.prototype.$setSize.apply(this, arguments);
			if(this._map)
				google.maps.event.trigger(this._map, "resize");
		},
		$onLoad:function(data){
			if(!this._map){
				this._waitMap.then(smdui.bind(function(){
					this.parse(data);
				}, this));
				return true;
			}
			return false;
		},
		_layerApi:{
			marker:{
				drawData:function(id, item, operation){
					switch (operation){
						case "add":
							item.$marker = this._getItemConfig(item);
							break;
						case "update":
							item.$marker.setMap(null);
							item.$marker = this._getItemConfig(item);
							break;
						case "delete":
							item.$marker.setMap(null);
							break;
						default:
							this.data.each(function(item){
								item.$marker = this._getItemConfig(item);
							}, this);
							break;
					}
				},
				clearAll:function(soft){
					this.data.each(function(obj){
						obj.$marker.setMap(null);
					});
					this.data.clearAll(soft);
				},
				showItem:function(id){
					var item = this.getItem(id);
					this._map.setCenter(new google.maps.LatLng(item.lat, item.lng));
				},
				_getItemConfig:function(item){
					var obj = {};
					for(var i in item) obj[i] = item[i];
					obj.position = new google.maps.LatLng(item.lat, item.lng);
					obj.map = item.hidden? null: this._map;

					var marker = new google.maps.Marker(obj);
					this._events(marker);
					this.callEvent("onItemRender", [item]);
					
					return marker;
				},
				_events:function(marker){
					var map = this;
					
					marker.addListener('click', function(){
						map.callEvent("onItemClick", [this.id, this]);
					});

					if(marker.getDraggable()){
						marker.addListener('dragend', function(){ map._onDrag(this, true); });
						marker.addListener('drag', function(){ map._onDrag(this); });
					}
				},
				_onDrag:function(marker, end){
					var item = this.getItem(marker.id);
					var pos = marker.getPosition();
					var ev = end?"onAfterDrop":"onDrag";

					item.lat = pos.lat();
					item.lng = pos.lng();
					this.callEvent(ev, [item.id, item]);
				}
			},
			heatmap:{
				heatmapConfig_setter:function(value){
					value = value || {};
					return value;
				},
				drawData:function(){
					if(this._heatmap){
						this._heatmap.setMap(null);
						this._heatmap = null;
					}

					var hdata = [];
					this.data.each(function(item){ hdata.push(this._getConfig(item)); }, this);

					if(hdata.length){
						var data = smdui.extend(this.config.heatmapConfig, {data:hdata, map:this._map}, true);
						this._heatmap = new google.maps.visualization.HeatmapLayer(data);
						this.callEvent("onHeatMapRender", [this._heatmap]);
					}
				},
				getHeatmap:function(){
					return this._heatmap;
				},
				_getConfig:function(item){
					var obj = {};
					for(var i in item) obj[i] = item[i];
					obj.location = new google.maps.LatLng(item.lat, item.lng);

					return obj;
				}
			}
		}
	}, smdui.DataLoader, smdui.EventSystem, smdui.ui.view);
})();


smdui.dp = function(name,getOnly){
	if (typeof name == "object" && name._settings)
		name = name._settings.id;
	if (smdui.dp._pull[name] || getOnly)
		return smdui.dp._pull[name];

	if (typeof name == "string"||typeof name == "number")
		name = { master:smdui.$$(name) };

	var dp = new smdui.DataProcessor(name);
	var masterId = dp._settings.master._settings.id;
	smdui.dp._pull[masterId]=dp;

	smdui.$$(masterId).attachEvent("onDestruct",function(){
		smdui.dp._pull[this._settings.id] = null;
		delete smdui.dp._pull[this._settings.id];
	});

	return dp;
};
smdui.dp._pull = {};
smdui.dp.$$ = function(id){
	return smdui.dp._pull[id];
};


smdui.DataProcessor = smdui.proto({
	defaults: {
		autoupdate:true,
		updateFromResponse:false,
		mode:"post",
		operationName:"smdui_operation",
		trackMove:false
	},


	/*! constructor
	 **/
	$init: function() {
		this.reset();
		this._ignore = false;
		this.name = "DataProcessor";
		this.$ready.push(this._after_init_call);
	},
	reset:function(){
		this._updates = [];
	},
	url_setter:function(value){
		/*
			we can use simple url or mode->url
		*/
		var mode = "";
		if (typeof value == "string"){
			var parts = value.split("->");
			if (parts.length > 1){
				value = parts[1];
				mode = parts[0];
			}
		} else if (value && value.mode){
			mode = value.mode;
			value = value.url;
		}

		if (mode)
			return smdui.proxy(mode, value);

		return value;
	},
	master_setter:function(value){
		var store = value;
		if (value.name != "DataStore")
			store = value.data;

		this._settings.store = store;
		return value;
	},
	/*! attaching onStoreUpdated event
	 **/
	_after_init_call: function(){
		smdui.assert(this._settings.store, "store or master need to be defined for the dataprocessor");
		this._settings.store.attachEvent("onStoreUpdated", smdui.bind(this._onStoreUpdated, this));
		this._settings.store.attachEvent("onDataMove", smdui.bind(this._onDataMove, this));
	},
	ignore:function(code,master){
		var temp = this._ignore;
		this._ignore = true;
		code.call((master||this));
		this._ignore = temp;
	},
	off:function(){
		this._ignore = true;
	},
	on:function(){
		this._ignore = false;
	},

	_copy_data:function(source){
		var obj = {};
		for (var key in source)	
			if (key.indexOf("$")!==0)
				obj[key]=source[key];
		return obj;
	},
	save:function(id, operation, obj){
		operation = operation || "update";
		this._save_inner(id, (obj || this._settings.store.getItem(id)), operation);
	},
	_save_inner:function(id, obj, operation){
		if (typeof id == "object") id = id.toString();
		if (!id || this._ignore === true || !operation || operation == "paint") return true;

		var store = this._settings.store;
		if (store && store._scheme_serialize)
			obj = store._scheme_serialize(obj);

		var update = { id: id, data:this._copy_data(obj), operation:operation };
		//save parent id
		if (!smdui.isUndefined(obj.$parent)) update.data.parent = obj.$parent;

		if (update.operation != "delete"){
			//prevent saving of not-validated records
			var master = this._settings.master;
			if (master && master.data && master.data.getMark && master.data.getMark(id, "smdui_invalid"))
				update._invalid = true;

			if (!this.validate(null, update.data))
				update._invalid = true;
		}

		if (this._check_unique(update))
			this._updates.push(update);

		if (this._settings.autoupdate)
			this.send();
			
		return true;
	},
	_onDataMove:function(sid, tindex, parent, targetid){
		if (this._settings.trackMove){
			var obj = smdui.copy(this._settings.store.getItem(sid));
			var order = this._settings.store.order;

			obj.smdui_move_index = tindex;
			obj.smdui_move_id = targetid;
			obj.smdui_move_parent = parent;
			this._save_inner(sid, obj, "order");
		}
	},
	_onStoreUpdated: function(id, obj, operation){
		switch (operation) {
			case 'save':
				operation = "update";
				break;
			case 'update':
				operation = "update";
				break;
			case 'add':
				operation = "insert";
				break;
			case 'delete':
				operation = "delete";				
				break;
			default:
				return true;
		}
		return this._save_inner(id, obj, operation);
	},
	_check_unique:function(check){
		for (var i = 0; i < this._updates.length; i++){
			var one = this._updates[i];
			if (one.id == check.id){
				if (check.operation == "delete"){
					if (one.operation == "insert")
						this._updates.splice(i,1);
					else 
						one.operation = "delete";
				}
				one.data = check.data;
				one._invalid = check._invalid;
				return false;
			}
		}
		return true;
	},
	send:function(){
		this._sendData();
	},
	_sendData: function(){
		if (!this._settings.url)
			return;

		var marked = this._updates;
		var to_send = [];
		var url = this._settings.url;

		for (var i = 0; i < marked.length; i++) {
			var tosave = marked[i];

			if (tosave._in_progress) continue;
			if (tosave._invalid) continue;

			var id = tosave.id;
			var operation = tosave.operation;
			var precise_url = (typeof url == "object" && !url.$proxy) ? url[operation] : url;
			var proxy = precise_url && (precise_url.$proxy || typeof precise_url === "function");

			if (!precise_url) continue;

			if (this._settings.store._scheme_save)
				this._settings.store._scheme_save(tosave.data);

			if (!this.callEvent("onBefore"+operation, [id, tosave]))
				continue;
			tosave._in_progress = true;

			if (!this.callEvent("onBeforeDataSend", [tosave])) return;

			tosave.data = this._updatesData(tosave.data);

			var callback = this._send_callback({ id:tosave.id, status:tosave.operation });
			if (precise_url.$proxy){
				if (precise_url.save)
					precise_url.save(this.config.master, tosave, this, callback);
				else
					to_send.push(tosave);
			} else {
				if (operation == "insert") delete tosave.data.id;

				
				if (proxy){
					//promise
					precise_url(tosave.id, tosave.operation, tosave.data).then(
						function(data){
							if (data && typeof data.json == "function")
								data = data.json();
							callback.success("", data, -1);
						},
						function(error){
							callback.error("", null, error);
						}
					);
				} else {
					//normal url
					tosave.data[this._settings.operationName] = operation;

					this._send(precise_url, tosave.data, this._settings.mode, operation, callback);
				}
			}

			this.callEvent("onAfterDataSend", [tosave]);
		}

		if (url.$proxy && url.saveAll && to_send.length)
			url.saveAll(this.config.master, to_send, this, this._send_callback({}));
	},


	/*! process updates list to POST and GET params according dataprocessor protocol
	 *	@param updates
	 *		list of objects { id: "item id", data: "data hash", operation: "type of operation"}
	 *	@return
	 *		object { post: { hash of post params as name: value }, get: { hash of get params as name: value } }
	 **/



	_updatesData:function(source){
		var target = {};
		for (var j in source){
			if (j.indexOf("$")!==0)
				target[j] = source[j];
		}
		return target;
	},



	/*! send dataprocessor query to server
	 *	and attach event to process result
	 *	@param url
	 *		server url
	 *	@param get
	 *		hash of get params
	 *	@param post
	 *		hash of post params
	 *	@mode
	 *		'post' or 'get'
	 **/
	_send: function(url, post, mode, operation, callback) {
		smdui.assert(url, "url was not set for DataProcessor");

		if (typeof url == "function")
			return url(post, operation, callback);

		smdui.ajax()[mode](url, post, callback);
	},
	_send_callback:function(id){
		var self = this;
		return {
			success:function(t,d,l){ return self._processResult(id, t,d,l); },
			error  :function(t,d,l){ return self._processError(id, t,d,l); }
		};
	},
	attachProgress:function(start, end, error){
		this.attachEvent("onBeforeDataSend", start);
		this.attachEvent("onAfterSync", end);
		this.attachEvent("onAfterSaveError", error);
		this.attachEvent("onLoadError", error);
	},
	_processError:function(id, text, data, loader){
		if (id)
			this._innerProcessResult(true, id.id, false, id.status, false, {text:text, data:data, loader:loader});
		else {
			this.callEvent("onLoadError", arguments);
			smdui.callEvent("onLoadError", [text, data, loader, this]);
		}
	},
	_innerProcessResult:function(error, id, newid, status, obj, details){
		var master = this._settings.master;
		var update = this.getItemState(id);
		update._in_progress = false;

		if (error){
			if (this.callEvent("onBeforeSaveError", [id, status, obj, details])){
				update._invalid = true;
				if(this._settings.undoOnError && master._settings.undo)
					master.undo(id);
				this.callEvent("onAfterSaveError", [id, status, obj, details]);
				return;
			}
		} else
			this.setItemState(id, false);

		//update from response
		if (newid && id != newid)
			this._settings.store.changeId(id, newid);

 		if (obj && status != "delete" && this._settings.updateFromResponse)
 			this.ignore(function(){				
				this._settings.store.updateItem(newid || id, obj);
 			});
			

		//clean undo history, for the saved record
		if(this._settings.undoOnError && master._settings.undo)
			master.removeUndo(newid||id);

		this.callEvent("onAfterSave",[obj, id, details]);
		this.callEvent("onAfter"+status, [obj, id, details]);
	},
	processResult: function(state, hash, details){
		//compatibility with custom json response
		var error = (hash && (hash.status == "error" || hash.status == "invalid"));
		var newid = (hash ? ( hash.newid || hash.id ) : false);

		this._innerProcessResult(error, state.id, newid, state.status, hash, details);
	},
	// process saving from result
	_processResult: function(state, text, data, loader){
		this.callEvent("onBeforeSync", [state, text, data, loader]);

		if (loader === -1){
			//callback from promise
			this.processResult(state, data, {});
		} else {
			var proxy = this._settings.url;
			if (proxy.$proxy && proxy.result)
				proxy.result(state, this._settings.master, this, text,  data, loader);
			else {
				var hash;
				if (text){
					hash = data.json();
					//invalid response
					if (text && typeof hash == "undefined")
						hash = { status:"error" };
				}
				this.processResult(state, hash,  {text:text, data:data, loader:loader});
			}
		}

		this.callEvent("onAfterSync", [state, text, data, loader]);
	},


	/*! if it's defined escape function - call it
	 *	@param value
	 *		value to escape
	 *	@return
	 *		escaped value
	 **/
	escape: function(value) {
		if (this._settings.escape)
			return this._settings.escape(value);
		else
			return encodeURIComponent(value);
	},
	getState:function(){
		if (!this._updates.length) return false;
		for (var i = this._updates.length - 1; i >= 0; i--)
			if (this._updates[i]._in_progress)
				return "saving";

		return true;
	},
	getItemState:function(id){
		var index = this._get_stack_index(id);
		return this._updates[index] || null;
	},
	setItemState:function(id, state){
		if (state)
			this.save(id, state);
		else{
			var index = this._get_stack_index(id);
			if (index > -1)
				this._updates.splice(index, 1);
		}
	},
	_get_stack_index: function(id) {
		var index = -1;
		var update = null;
		for (var i=0; i < this._updates.length; i++)
			if (this._updates[i].id == id) {
				index = i;
				break;
			}

		return index;
	}

}, smdui.Settings, smdui.EventSystem, smdui.ValidateData);


(function(){

var timers = {};
smdui.jsonp = function(url, params, callback, master){
	var defer = smdui.promise.defer();

	var id = "smdui_jsonp_"+smdui.uid();
	var script = document.createElement('script');
	script.id = id;
	script.type = 'text/javascript';

	var head = document.getElementsByTagName("head")[0];

	if (typeof params == "function"){
		master = callback;
		callback = params;
		params = {};
	}

	if (!params)
		params = {};

	params.jsonp = "smdui.jsonp."+id;
	smdui.jsonp[id]=function(){
		if (callback)
			callback.apply(master||window, arguments);
		defer.resolve(arguments[0]);

		window.clearTimeout(timers[id]);
		delete timers[id];

		script.parentNode.removeChild(script);
		callback = head = master = script = null;
		delete smdui.jsonp[id];
	};

	//timeout timer
	timers[id] = window.setTimeout(function(){
		defer.reject();
		delete smdui.jsonp[id];
	}, smdui.jsonp.timer);
	
	var vals = [];
	for (var key in params) vals.push(key+"="+encodeURIComponent(params[key]));
	
	url += (url.indexOf("?") == -1 ? "?" : "&")+vals.join("&");

    script.src = url;
    head.appendChild(script);

    return defer;
};

smdui.jsonp.timer = 3000;

})();

smdui.markup = {
	namespace:"x",
	attribute:"data-",
	dataTag:"li",
	_dash:/-([a-z])/g,
	_after_dash:function (match) { return match[1].toUpperCase(); },
	_parse_int:{
		width:true,
		height:true,
		gravity:true,
		margin:true,
		padding:true,
		paddingX:true,
		paddingY:true,
		minWidth:true,
		maxWidth:true,
		minHeight:true,
		maxHeight:true,
        headerRowHeight:true
	},
	_parse_bool:{
		disabled:true,
		hidden:true
	},
	_view_has_method:function(view, name){
		return smdui.ui.hasMethod(view, name);
	},

	init: function(node, target, scope){
		node = node || document.body;

		var els = [];
		var temp = this._get_core_els(node);
		var html = temp.html;
		var ui = null;

		//make copy to prevent node removing effects
		for (var i = temp.length - 1; i >= 0; i--) els[i] = temp[i];
		
		for (var i = 0; i < els.length; i++) {
			var config, temp_config;
			//collect configuration
			config = this._sub_markup(els[i], html);
			config.$scope = scope;
			ui = this._initComponent(config, els[i], html, target);
		}
		return ui;
	},

	parse:function(source, mode){
		//convert from string to object
		if (typeof source == "string")
			source = smdui.DataDriver[mode || "xml"].toObject(source, source);

		var els = this._get_core_els(source, mode);
		return this._sub_markup(els[0], els.html);
	},

	_initComponent:function(config, node, html, target){
		if (!target){
			config.container = node.parentNode;
			smdui.html.remove(node);
		} else 
			config.container = target;

		if (this._view_has_method(config.view, "setPosition"))
			delete config.container;

		//init ui
		return smdui.ui(config);
	},

	_get_core_els:function(node){
		this._full_prefix = this.namespace?(this.namespace+":"):"";
		this._full_prefix_top = this._full_prefix+"ui";

		//xhtml mode
		var els = node.getElementsByTagName(this._full_prefix_top);
		if (!els.length && node.documentElement && node.documentElement.tagName == this._full_prefix_top)
			els = [ node.documentElement ];

		//loading from xml file with valid namespace
		if (!els.length && this.namespace){
			els = node.getElementsByTagName("ui");
			if (!els.length && node.documentElement && node.documentElement.tagName == "ui")
				els = [ node.documentElement ];
		}

		if (!els.length){
			//html mode
			els = this._get_html_tops(node);
			els.html = true;
		}
		return els;
	},

	//html conversion
	_get_html_tops: function(node){
		if (node.getAttribute && node.getAttribute(this.attribute+"view"))
			return [node];

		var els = node.querySelectorAll("["+this.attribute+"view]");

		var tags = []; var marks = [];
		for (var i = 0; i < els.length; i++)
			if (!els[i].parentNode.getAttribute(this.attribute+"view"))
				tags.push(els[i]);

		return tags;
	},



	_sub_markup: function(el, html, json){
		var htmltable = false;
		//ignore top x:ui for xhtml and xml 
		if (!json){
			var name = this._get_name(el, html);
			if (name == "ui"){
				var childs = el.childNodes;
				for (var i = 0; i < childs.length; i++)
					if (childs[i].nodeType == 1){
						return this._sub_markup(childs[i], html);
					}
			}
			json = { view: name };
			if (html && el.tagName.toLowerCase() == "table"){
				json.data = el;
				json.datatype = "htmltable";
				htmltable = true;
			}
		}

		var is_layout = json.view == "cols" || json.view == "rows" || this._view_has_method(json.view, "addView");

		var subs = [];
		var has_tags = 0; 
		var allow_sub_tags = !(html || el.style); //only for xml documents
		var first = el.firstChild;
		while (first){
			//tag node
			if (first.nodeType == 1){
				var name = this._get_name(first, html);
				if (name == "data"){
					has_tags = 1;
					var data = first; first = first.nextSibling;
					json.data = this._handle_data(data, html);
					continue;
				} else if (name == "config"){
					this._get_config_html(first, json, html);
					var confignode = first;
					first = first.nextSibling;

					smdui.html.remove(confignode);
					continue;
				} else if (name == "column"){
					has_tags = 1;

					var column = this._tag_to_json(first, html);
					column.header = column.header || column.value;
					column.width = column.width * 1 || "";

					json.columns = json.columns || [];
					json.columns.push(column);
				} else if (name || (is_layout && html)){
					var obj = this._sub_markup(first , html , { view:name });
					if (obj.view == "head")
						json.head = obj.rows ? obj.rows[0] : obj.template;
					else if (obj.view == "body"){
						if (this._view_has_method(json.view, "addView")){
							//multiview, accordion

							//subtag or plain value
							//in case of multiple sub tags, only first will be used
							// #dirty
							subs.push({
								body: (obj.rows ? obj.rows[0] : obj.value),
								header:obj.header || ""
							});
						} else {
							//window, fieldset

							//one sub tag - use it
							//multiple sub tags - create sub layout
							//or use plain text value
							json.body = obj.rows ? ( obj.rows.length == 1 ? obj.rows[0] : { rows:obj.rows } ) : obj.value;
						}
					} else
						subs.push(obj);
				} else if (allow_sub_tags) {
					has_tags = 1;
					var tagName = first.tagName;
					if (html) tagName = tagName.toLowerCase().replace(this._dash, this._after_dash);
					json[tagName] = smdui.DataDriver.xml.tagToObject(first);
					
				}
			}

			first = first.nextSibling;
		}

		this._attrs_to_json(el, json, html);

		if (subs.length){
			if (json.stack)
				json[json.stack] = subs;
			else if (this._view_has_method(json.view, "setValues"))
				json["elements"] = subs;
			else if (json.view == "rows"){
				json.view = "layout";
				json.rows = subs;
			} else if (json.view == "cols"){
				json.view = "layout";
				json.cols = subs;
			} else if (this._view_has_method(json.view, "setValue")){
				json["cells"] = subs;
			} else if (this._view_has_method(json.view, "getBody")){
				json.body = subs.length == 1 ? subs[0] : { rows:subs };
			} else
				json["rows"] = subs;
		} else if (!htmltable && !has_tags){
			if (html && !json.template && (!json.view || json.view == "template")){
				json.view = "template";
				json.content = el;
			} else {
				var content = this._content(el, html);
				if (content){
					var target = "template";
					if (this._view_has_method(json.view, "setValue"))
						target = "value";
					json[target] = json[target] || content;	
				}
			}
		}

		return json;
	},

	_empty: function(str) {
		var clean = str.replace(/\s+/gm, '');
		return (clean.length > 0) ? false : true;	 
	},

	_markup_names:{
		body:1,
		head:1,
		data:1,
		rows:1,
		cols:1,
		cells:1,
		elements:1,
		ui:1,
		column:1,
		config:1
	},

	_get_config_html:function(tag, json, html){
		var master = this._attrs_to_json(tag, { });
		if (master.name){
			json[master.name] = master;
			delete master.name;
		} else 
			if (master.stack) json[master.stack] = [];
		else
			json = master;

		var childs = tag.childNodes;
		for (var i = 0; i < childs.length; i++) {
            var sub = null;
			if (childs[i].nodeType == 1 && childs[i].tagName.toLowerCase() == "config" && childs[i].attributes.length)
				sub = this._get_config_html(childs[i], master, html);
            else
                sub = childs[i].innerHTML;
            if (master.stack && sub)
                json[master.stack].push(sub);

		}
		return json;
	},

	_get_name:function(tag, html){
		//value of view attribute or config tag
		if (html)
			return tag.getAttribute(this.attribute+"view") || ( tag.tagName.toLowerCase() == "config" ? "config" : null);
		var name = tag.tagName.toLowerCase();
		if (this.namespace){
			if (name.indexOf(this._full_prefix) === 0 || tag.scopeName == this.namespace)
				return name.replace(this._full_prefix,"");
		} else {
			if (smdui.ui[name] || this._markup_names[name])
				return name;
		}
		return 0;
	},

	_handle_data:function(el, html){
		var data = [];

		var records = el.getElementsByTagName(smdui.markup.dataTag);
		for (var i=0; i<records.length; i++){
			var rec = records[i];
			if (rec.parentNode.parentNode.tagName != smdui.markup.dataTag){
				var json = this._tag_to_json(rec, html);
				//reuse css class 
				if (rec.className) json.$css = rec.className;
				data.push(json);
			}
		}

		smdui.html.remove(el);

		return data;
	},
	_content:function(el, html){
		if (el.style) return el.innerHTML;
		if (el.firstChild)
			return el.firstChild.wholeText||el.firstChild.data||"";
		return "";
	},


	_tag_to_json:function(el, html){
		if (!html)
			return smdui.DataDriver.xml.tagToObject(el);

		var json = this._attrs_to_json(el, {}, html);
		if (!json.value && el.childNodes.length)
			json.value = this._content(el, html);

		return json;
	},
	_attrs_to_json:function(el, json, html){
		var attrs = el.attributes;
        for (var i=0; i<attrs.length; i++){
            var name = attrs[i].name;
            if (html){
                if (name.indexOf(this.attribute) !== 0)
                    continue;
                name = name.replace(this.attribute,"").replace(this._dash, this._after_dash);
            }

            var value = attrs[i].value;
            if (value.indexOf("json://") != -1)
                value = JSON.parse(value.replace("json://",""));

            if (this._parse_int[name])
                value = parseInt(value,10);
            else if (this._parse_bool[name])
            	value = (value && value !== "false" && value != "0");

            json[name] = value;
        }
        return json;
	}
};
(function(){
	var _smdui_msg_cfg = null;
	function callback(config, result){
			var usercall = config.callback;
			modality(false);
			config.box.parentNode.removeChild(config.box);
			_smdui_msg_cfg = config.box = null;
			if (usercall)
				usercall(result,config.details);
	}
	function modal_key(e){
		if (_smdui_msg_cfg){
			e = e||event;
			var code = e.which||event.keyCode;
			if (smdui.message.keyboard){
				if (code == 13 || code == 32)
					callback(_smdui_msg_cfg, true);
				if (code == 27)
					callback(_smdui_msg_cfg, false);
			
				if (e.preventDefault)
					e.preventDefault();
				return !(e.cancelBubble = true);
			}
		}
	}

	smdui.event(document, "keydown", modal_key, { capture: true });
		
	function modality(mode){
		if(!modality.cover || !modality.cover.parentNode){
			modality.cover = document.createElement("DIV");
			//necessary for IE only
			modality.cover.onkeydown = modal_key;
			modality.cover.className = "smdui_modal_cover";
			document.body.appendChild(modality.cover);
		}
		modality.cover.style.display = mode?"inline-block":"none";
	}

	function button(text, result, className){
		return "<div role='button' tabindex='0' aria-label='"+text+"' class='smdui_popup_button"+(className?(" "+className):"")+"' result='"+result+"' ><div>"+text+"</div></div>";
	}

    function info(text) {
		if (!t.area){
			t.area = document.createElement("DIV");
			t.area.className = "smdui_message_area";
			t.area.style[t.position]="5px";
			
			document.body.appendChild(t.area);
		}
		t.area.setAttribute("role", "alert");
		t.area.setAttribute("aria-atomic", true);
		t.hide(text.id);
		var message = document.createElement("DIV");
		message.innerHTML = "<div>"+text.text+"</div>";
		message.className = "smdui_info smdui_" + text.type;
		message.onclick = function(){
			t.hide(text.id);
			text = null;
		};

		if (smdui.$testmode)
			message.className += " smdui_no_transition";

		if (t.position == "bottom" && t.area.firstChild)
			t.area.insertBefore(message,t.area.firstChild);
		else
			t.area.appendChild(message);
		
		if (text.expire > 0)
			t.timers[text.id]=window.setTimeout(function(){
				t.hide(text.id);
			}, text.expire);

		//styling for animation
		message.style.height = message.offsetHeight-2+"px";

		t.pull[text.id] = message;
		message = null;

		return text.id;
	}
	function _boxStructure(config, ok, cancel){
		var box = document.createElement("DIV");
		box.className = " smdui_modal_box smdui_"+config.type;
		box.setAttribute("smduibox", 1);
		box.setAttribute("role", "alertdialog");
		box.setAttribute("aria-label", config.title || "");
		box.setAttribute("tabindex", "0");
			
		var inner = '';
		if (config.width)
			box.style.width = config.width+(smdui.rules.isNumber(config.width)?"px":"");
		if (config.height)
			box.style.height = config.height+(smdui.rules.isNumber(config.height)?"px":"");
		if (config.title)
			inner+='<div class="smdui_popup_title">'+config.title+'</div>';
		inner+='<div class="smdui_popup_text"><span>'+(config.content?'':config.text)+'</span></div><div  class="smdui_popup_controls">';
		if (ok || config.ok)
			inner += button(config.ok || "OK", true,"confirm");
		if (cancel || config.cancel)
			inner += button(config.cancel || "Cancel", false);
		if (config.buttons){
			for (var i=0; i<config.buttons.length; i++)
				inner += button(config.buttons[i],i);
		}
		inner += '</div>';
		box.innerHTML = inner;

		if (config.content){
			var node = config.content;
			if (typeof node == "string") 
				node = document.getElementById(node);
			if (node.style.display == 'none')
				node.style.display = "";
			box.childNodes[config.title?1:0].appendChild(node);
		}

		box.onclick = function(e){
			e = e ||event;
			var source = e.target || e.srcElement;
			if (!source.className) source = source.parentNode;
			if (source.className.indexOf("smdui_popup_button")!=-1){
				var result = source.getAttribute("result");
				result = (result == "true")||(result == "false"?false:result);
				callback(config, result);
			}
			e.cancelBubble = true;
		};
		config.box = box;
		if (ok||cancel||config.buttons)
			_smdui_msg_cfg = config;

		return box;
	}
	function _createBox(config, ok, cancel){
		var box = config.tagName ? config : _boxStructure(config, ok, cancel);
		
		if (!config.hidden)
			modality(true);
		document.body.appendChild(box);
		var x = config.left||Math.abs(Math.floor(((window.innerWidth||document.documentElement.offsetWidth) - box.offsetWidth)/2));
		var y = config.top||Math.abs(Math.floor(((window.innerHeight||document.documentElement.offsetHeight) - box.offsetHeight)/2));
		if (config.position == "top")
			box.style.top = "-3px";
		else
			box.style.top = y+'px';
		box.style.left = x+'px';
		//necessary for IE only
		box.onkeydown = modal_key;

		box.focus();
		if (config.hidden)
			smdui.modalbox.hide(box);

		return box;
	}

	function alertPopup(config){
		return _createBox(config, true, false);
	}
	function confirmPopup(config){
		return _createBox(config, true, true);
	}
	function boxPopup(config){
		return _createBox(config);
	}
	function box_params(text, type, callback){
		if (typeof text != "object"){
			if (typeof type == "function"){
				callback = type;
				type = "";
			}
			text = {text:text, type:type, callback:callback };
		}
		return text;
	}
	function params(text, type, expire, id){
		if (typeof text != "object")
			text = {text:text, type:type, expire:expire, id:id};
		text.id = text.id||t.uid();
		text.expire = text.expire||t.expire;
		return text;
	}
	smdui.alert = function(){
		var text = box_params.apply(this, arguments);
		text.type = text.type || "confirm";
		return alertPopup(text);
	};
	smdui.confirm = function(){
		var text = box_params.apply(this, arguments);
		text.type = text.type || "alert";
		return confirmPopup(text);
	};
	smdui.modalbox = function(){
		var text = box_params.apply(this, arguments);
		text.type = text.type || "alert";
		return boxPopup(text);
	};
	smdui.modalbox.hide = function(node){
		if(node){
			while (node && node.getAttribute && !node.getAttribute("smduibox"))
				node = node.parentNode;
			if (node){
				node.parentNode.removeChild(node);
			}
		}

		modality(false);
		_smdui_msg_cfg = null;
	};
    var t = smdui.message = function (text, type, expire, id) {
		text = params.apply(this, arguments);
		text.type = text.type||"info";

		var subtype = text.type.split("-")[0];
		switch (subtype){
			case "alert":
				return alertPopup(text);
			case "confirm":
				return confirmPopup(text);
			case "modalbox":
				return boxPopup(text);
			default:
				return info(text);
		}
	};

	t.seed = (new Date()).valueOf();
	t.uid = function(){return t.seed++;};
	t.expire = 4000;
	t.keyboard = true;
	t.position = "top";
	t.pull = {};
	t.timers = {};

	t.hideAll = function(){
		for (var key in t.pull)
			t.hide(key);
	};
	t.hide = function(id){
		var obj = t.pull[id];
		if (obj && obj.parentNode){
			window.setTimeout(function(){
				obj.parentNode.removeChild(obj);
				obj = null;
			},2000);
			//styling for animation
			obj.style.height = 0;
			obj.className+=" hidden";
			t.area.removeAttribute("role");
			
			if(t.timers[id])
				window.clearTimeout(t.timers[id]);
			delete t.pull[id];
		}
	};
})();

smdui.debug_ready(function(){

	var ignore = {
		"_inner":true, 
		"awidth":true,
		"cheight":true,
		"bheight":true,
		"aheight":true
	};

	function get_inspector_config(view){
		var values={};
		var options=[];
		view = smdui.$$(view);

		for (var key in view.config){
			if (ignore[key]) continue;
			
			if (typeof view.config[key] == "object") continue;
			if (typeof view.config[key] == "undefined") continue;
			if (typeof view.config[key] == "function") continue;

			if (key == "view" || key == "id")
				options.push({ label:key, id:key});
			else 
				options.push({ label:key, type:"text", id:key});

			if (view.defaults[key] == view.config[key]) 
				options[options.length - 1].css = { "color" : "#888" };

			values[key] = view.config[key];
		}
		options.sort(function(a,b){
			if (!a.css && b.css) return -1;
			if (a.css && !b.css) return 1;
			return (a.id > b.id) ? 1 : ((a.id == b.id) ? 0 : -1);
		});

		return { elements:options, data:values, head:" ["+view.name+"] <strong>"+view._settings.id+"</strong>" };
	}

	function create_inspector(){
		if (!smdui.$$("smdui_debug_inspector_win"))
			smdui.ui({
				id:"smdui_debug_inspector_win",
				view:"window", 
				top:2, left: 0, width:350, height:350,
				head:false, autofit:false,
				body:{cols:[
					{ width:10},
					{type:"clean", rows:[
						{ view:"toolbar", elements:[
							{ view:"label", value:"", id:"smdui_debug_inspector_head" },
							{ view:"button", width:100, value:"Hide", type:"custom", click:function(){
								smdui.debug_inspect();
							}}
						]},
						{
							id:"smdui_debug_inspector", nameWidth:150,
							view:"property", scroll:"y",
							elements:[],
							on:{
								onaftereditstop:function(state, editor){
									if (state.old == state.value) return;

									var value = state.value;
									if (value === "true" || value === "false"){
										value = (value === "true");
									} else {
										var intvalue = parseInt(value,10);
										if (intvalue == value)
											value = intvalue;
									}

									var view = smdui.$$(this.config.view);
									view.define(editor.id, value);
									if (view.refreshColumns)
										view.refreshColumns();
									else if (view.refresh)
										view.refresh();

									view.resize();
								}
							}
						}
						]
					}]
				}
			});
	}
	function show_inspector(view, ev){
		create_inspector();
		var win = smdui.$$("smdui_debug_inspector_win");

		if (view){
			var config = get_inspector_config(view);
			var winx = document.body.offsetWidth;
			var winy = document.body.offsetHeight;
			var pos = ev?smdui.html.pos(ev):{x:0,y:0};

			win.define("height", Math.max(350, winy-4));
			win.resize();

			var props = smdui.$$("smdui_debug_inspector");
			props.define("elements", config.elements);
			props.define("view", view);

			win.show({ x:(pos.x > winx/2 )?0:(winx-370), y:0 });
			smdui.$$("smdui_debug_inspector").setValues(config.data);
			smdui.$$("smdui_debug_inspector_head").setValue(config.head);
		} else 
			win.hide();
	}
	smdui.debug_inspect = show_inspector;

	function infi(value){
		if (value >= 100000)
			return "Any";
		return value;
	}
	function log_level(data, prefix, now){
		window.console.log((data == now?">>":"  ")+prefix + data.name+" / " +data.config.id);
		prefix+="  ";
		if (data._cells)
			for (var i=0; i<data._cells.length; i++){
				log_level(data._cells[i], prefix, now);
			}
		if (data._head_cell)
			log_level(data._head_cell, prefix, now);

		if (data._body_cell)
			log_level(data._body_cell, prefix, now);
	}

	smdui.ui({
		view:"contextmenu",
		id:"smdui:debugmenu",
		on:{
			onBeforeShow:function(e){
				if (!e.ctrlKey) return false;

				var view = smdui.html.locate(e, "view_id");
				if (!view) return false;
				this.config.lastTarget = view;

				smdui.blockEvent();
				smdui.delay(function(){ smdui.unblockEvent(); });
			},
			onShow:function(){
				var view = smdui.$$(this.config.lastTarget);
				var info = "<span style='color:#888'>"+view._settings.id + "<sup style='float:right'>["+view.name+"]</sup></span>";
				document.getElementById("smdui_debug_cmx").innerHTML = info;
			}
		},
		data:[
			"<div id='smdui_debug_cmx'></div>",
			{ id:"inspect", value:"Inspect"},
			{ id:"docs", value:"Documentation"},
			{
				value:"Log to Console", submenu:[
					{ id:"size", value:"Sizes" },
					{ id:"tree", value:"Tree" },
					{ id:"dump", value:"Dump"}
				]
			}		
		],
		click:function(id, ev){
			//mixing two object result in confusion
			var obj = smdui.$$(this.config.lastTarget);

			if  (id == "dump"){
				window.console.info("\n"+obj.name+" / "+obj.config.id);
				window.console.log("\nView: ",obj,", Config: ", obj.config, ", Data: ", obj.data);
				window.console.log(obj.$view);
			}

			if (id == "tree"){
				
				var now = obj;
				while (obj.getParentView())
					obj = obj.getParentView();

				window.console.log("");
				log_level(obj, "", now);
			}

			if (id == "size"){
				window.console.info("");
				window.console.info("\n"+obj.name+" / "+obj.config.id);
				window.console.info("\n[min]   ", obj.config.width, " x ", obj.config.height);
				var sizes = obj.$getSize(0,0);
				window.console.info("[max]    ", infi(sizes[1]), " x ", infi(sizes[3])+(obj.config.autoheight?", auto height":""));
				window.console.info("[gravity]   ", obj.config.gravity);

				window.console.info("\n[content]    ", obj._content_width, " x ", obj._content_height);
				window.console.info("[last set]   ", obj._last_size[0], " x ", obj._last_size[1]);
				if (obj._settings._inner)
					window.console.info("\n[borders]   ", "left:", !obj._settings._inner.left,"\ttop:", !obj._settings._inner.top,  "\tright:", !obj._settings._inner.right,  "\tbottom:", !obj._settings._inner.bottom);
				else
					window.console.info("\n[borders]   none");
			}

			if (id == "docs")
				window.open("http://docs.smdui.com/api__refs__ui."+obj.name+".html","__blank");

			if (id == "inspect"){
				show_inspector(this.config.lastTarget, ev);
			}
		},
		master:document.body
	});
});


smdui.protoUI({
	name:"carousel",
	defaults:{
		scrollSpeed:"300ms",
		type: "clean",
		navigation: {},
		animate:true
	},
	$init:function(config){
		this._viewobj.className += " smdui_carousel";
		this._layout = null;
		this._dataobj = null;
		this._active_cell = 0;
		this.$ready.unshift(this._initLayout);
		this.$ready.push(this._after_init_call);
	},
	addView: function(view, index){
		var t = this._layout.addView(view, index);
		this._fix_after_view_add();
		return t;
	},
	removeView: function(id){
		this._layout.removeView(id);
		this._fix_after_view_add();
	},
	_replace: function(new_view,target_id){
		this._layout._replace(new_view, target_id);
		this._fix_after_view_add();
	},
	_fix_after_view_add: function(){
 		this._cells = this._layout._cells;
 		this._renderPanel();
 		this.setActiveIndex(Math.min(this._active_cell, this._cells.length-1));
	},
	_initLayout: function(){
		if(this._layout && this._layout.destructor)
			this._layout.destructor();

		var layout = "";

		if(this.config.cols){
			layout = "cols";
			this._vertical_orientation = 0;
		}
		else{
			layout = "rows";
			this._vertical_orientation = 1;
		}

		var config = {borderless: true, type: "clean"};
		config[layout] = smdui.copy(this._settings[layout]);
		var layoutProp = ["type", "margin", "marginX", "marginY", "padding", "paddingX", "paddingY"];
		var layoutConfig = {};
		for(var i=0; i< layoutProp.length; i++){
			if(this._settings[layoutProp[i]]){
				layoutConfig[layoutProp[i]] = this._settings[layoutProp[i]];
			}
		}
		smdui.extend(config,layoutConfig,true);

		this._layout = smdui.ui._view(config);
		this._layout._parent_cell = this;

		this._viewobj.appendChild(this._layout._viewobj);
		this._cells = this._layout._cells;

		this._layout._show = smdui.bind(smdui.ui.carousel.prototype._show,this);
		this._layout.adjustScroll = smdui.bind(smdui.ui.carousel.prototype.adjustScroll,this);

		smdui.attachEvent("onReconstruct", smdui.bind(function(view){
			if(view == this._layout)
				this._setScroll();
		},this));

		this._contentobj = this._viewobj.firstChild;
	},
	_onKeyPress:function(code, e){
		if(this._settings.navigation.items && e.target.getAttribute("role") === "tab")
			this._moveActive(code, e);

		smdui.ui.baseview.prototype._onKeyPress.call(this, code, e);
	},
	getChildViews:function(){
		return [this._layout];
	},
	getLayout:function(){
		return this._layout;
	},
	_after_init_call:function(){
		this._contentobj.setAttribute("touch_scroll", (this._vertical_orientation?"y":"x"));

		this._layout.attachEvent("onAfterScroll",smdui.bind(function(view){
			this.callEvent("onShow",[this.getActiveId()]);
		},this));

		smdui.ui.each(this._layout, function(view){
			view._viewobj.setAttribute("role", "tabpanel");
		});
	},
	adjustScroll:function(matrix){
		var size =  (this._vertical_orientation?this._content_height:this._content_width);

		var correction;
		if (this._vertical_orientation) {
			correction = Math.round(matrix.f/size);
			matrix.f = correction*size;
		} else {
			correction = Math.round(matrix.e/size);
			matrix.e = correction*size;
		}
		
		this._active_cell = - correction;

		if(this._settings.navigation)
			this._renderNavItems();

		return true;
	},
	_show:function(obj){
		var i, layout, _nextCell, _size, x, y;
		_nextCell = -1;
		layout = this._layout;
		for (i=0; i < layout._cells.length; i++){
			if (layout._cells[i]==obj){
				_nextCell = i;
				break;
			}
		}

		if (_nextCell < 0 || _nextCell == this._active_cell)
			return;

		this._active_cell = _nextCell;
		_size =  (layout._vertical_orientation?this._content_height:this._content_width);

		x = -(layout._vertical_orientation?0:_nextCell*_size);
		y = -(layout._vertical_orientation?_nextCell*_size:0);

		this.scrollTo(x,y);
		this.callEvent("onShow",[layout._cells[this._active_cell]._settings.id]);
		if(this._settings.navigation)
			this._renderPanel();
	},
	scrollTo:function(x,y){
		if (smdui.Touch && smdui.animate.isSupported() && this._settings.animate)
			smdui.Touch._set_matrix(this._contentobj, x,y, this._settings.scrollSpeed||"100ms");
		else{
			this._contentobj.style.marginLeft = x+"px";
			this._contentobj.style.marginTop =  y+"px";
		}
	},
	navigation_setter:function(config){
		this._mergeSettings(config,{
			type: "corner",
			buttons: true,
			items: true
		});
		return config;
	},
	showNext:function(){
		if (this._active_cell < this._layout._cells.length - 1)
			this.setActiveIndex(this._active_cell+1);
	},
	showPrev:function(){
		if (this._active_cell > 0)
			this.setActiveIndex(this._active_cell-1);
	},
	setActiveIndex:function(value){
		smdui.assert(value < this._layout._cells.length, "Not existing index in collection");

		var id = this._layout._cells[value]._settings.id;
		smdui.$$(id).show();
	},
	getActiveIndex:function(){
		return this._active_cell;
	},
	$getSize:function(dx, dy){
		var layoutSizes = this._layout.$getSize(0, 0);
		var selfSizes   = smdui.ui.view.prototype.$getSize.call(this, dx, dy);
		if(this._layout._vertical_orientation){
			selfSizes[0] = Math.max(selfSizes[0], layoutSizes[0]);
			selfSizes[1] = Math.min(selfSizes[1], layoutSizes[1]);

		} else{
			selfSizes[2] = Math.max(selfSizes[2], layoutSizes[2]);
			selfSizes[3] = Math.min(selfSizes[3], layoutSizes[3]);
		}
		return selfSizes;
	},
	$setSize:function(x,y){
		var layout = this._layout;
		var c = layout._cells.length;

		var changed = smdui.ui.view.prototype.$setSize.call(this,x,y);
		var yc = this._content_height*(layout._vertical_orientation?c:1);
		var xc = this._content_width*(layout._vertical_orientation?1:c);

		if (changed){
			this._contentobj.style.height = yc+"px";
			this._contentobj.style.width = xc+"px";
			layout.$setSize(xc,yc);
			this._setScroll();
		} else
			layout.$setSize(xc,yc);
	},
	_setScroll: function(){
		var layout = this._layout;
		var activeCell = this._active_cell||0;
		var size =  (layout._vertical_orientation?this._content_height:this._content_width);

		var x = -(layout._vertical_orientation?0:activeCell*size);
		var y = -(layout._vertical_orientation?activeCell*size:0);


		this.scrollTo(x,y);

		if(this._settings.navigation)
			this._renderPanel();
	},
	getActiveId:function(){
		var cell = this._layout._cells[this._active_cell];
		return cell?cell._settings.id:null;
	},
	setActive:function(value){
		smdui.$$(value).show();
	}
}, smdui.EventSystem,smdui.NavigationButtons, smdui.ui.view);

/*
	UI:Uploader
*/
smdui.type(smdui.ui.list, {
	name:"uploader",
	template:"#name#  {common.removeIcon()}{common.percent()}<div style='float:right'>#sizetext#</div>",
	percent:function(obj){
		if (obj.status == 'transfer')
			return "<div style='width:60px; text-align:center; float:right'>"+obj.percent+"%</div>";
		return "<div class='smdui_upload_"+obj.status+"'><span class='"+(obj.status =="error"?"error_icon":"fa-check smdui_icon")+"'></span></div>";
	},
	removeIcon:function(obj){
		return "<div class='smdui_remove_upload'><span class='cancel_icon'></span></div>";
	},
	on_click:{
		"smdui_remove_upload":function(ev, id){
			smdui.$$(this.config.uploader).files.remove(id);
		}
	}
});

smdui.UploadDriver = {
	flash: {
		$render: function(render_config) {

			if (!window.swfobject)
				smdui.require("legacy/swfobject.js", true); // sync loading

			var config = this._settings;
			config.swfId = (config.swfId||"smdui_swf_"+smdui.uid());

			this._getBox().innerHTML += "<div class='smdui_upload_flash'><div id='"+config.swfId+"'></div></div>";
			this._upload_area = this._getBox().lastChild;

			// add swf object
			swfobject.embedSWF(smdui.codebase+"/legacy/uploader.swf", config.swfId, "100%", "100%", "9", null, {
					uploaderId: config.id,
					ID: config.swfId,
					enableLogs:(config.enableLogs?"1":""),
					paramName:(config.inputName),
					multiple:(config.multiple?"Y":"")
			}, {wmode:"transparent"});

			var v = swfobject.getFlashPlayerVersion();

			smdui._event(this._viewobj, "click", smdui.bind(function() {
				var now_date = new Date();
				if (now_date - (this._upload_timer_click||0)  > 250){
					this.fileDialog();
				}
			}, this));

			this.files.attachEvent("onBeforeDelete", smdui.bind(this._stop_file,this));
		},
		$applyFlash: function(name,params){
			return this[name].apply(this,params);
		},
		getSwfObject: function(){
			return swfobject.getObjectById(this._settings.swfId);
		},
		fileDialog:function(){
			if(this.getSwfObject())
				this.getSwfObject().showDialog();
		},
		send: function(id){
			if (typeof id == "function"){
				this._last_assigned_upload_callback = id;
				id = 0;
			}

			if (!id){
				var order = this.files.data.order;
				var complete = true;
				if (order.length)
					for (var i=0; i<order.length; i++){
						complete = this.send(order[i])&&complete;
					}

				if (complete)
					this._upload_complete();

				return;
			}
			var item = this.files.getItem(id);
			if (item.status !== 'client')
				return false;
			item.status = 'transfer';

			if(this.getSwfObject()){
				var url = this._get_active_url(item);
				var details = smdui.extend(item.formData||{},this._settings.formData||{});
				this.getSwfObject().upload(id, url, details);
			}
			return true;

		},
		$beforeAddFileToQueue: function( id, name, size ){

			var type = name.split(".").pop();
			var format = this._format_size(size);
			return this.callEvent("onBeforeFileAdd", [{
				id: id,
				name:name,
				size:size,
				sizetext:format,
				type:type
			}]);
		},
		$addFileToQueue: function(id, name, size){
			if(this.files.exists(id))
				return false;
			if (!this._settings.multiple)
				this.files.clearAll();
			var type = name.split(".").pop();
			var format = this._format_size(size);
			var file_struct = {
				name:name,
				id: id,
				size:size,
				sizetext:format,
				type:type,
				status:"client"
			};
			this.files.add(file_struct);
			this.callEvent("onAfterFileAdd", [file_struct]);

			if (id && this._settings.autosend)
				this.send(id);
		},
		stopUpload: function(id){
			this._stop_file(id);
		},
		_stop_file: function(id) {
			var item = this.files.getItem(id);
			if(item.status == "transfer"){
				this.getSwfObject().uploadStop(id);
				item.status = "client";
			}
		},
		$onUploadComplete: function(){
			if(this._settings.autosend){
				this._upload_complete();
			}
		},
		$onUploadSuccess: function(id,name,response){
			var item = this.files.getItem(id);
			if(item){
				item.status = "server";
				item.progress = 100;
				if(response.text && (typeof response.text == "string")){


					smdui.DataDriver.json.toObject(response.text);

					smdui.extend(item,response,true);
				}
				this.callEvent("onFileUpload", [item,response]);
				this.callEvent("onChange", []);
				this.files.updateItem(id);
			}
		},
		$onUploadFail: function(id){
			var item = this.files.getItem(id);
			item.status = "error";
			delete item.percent;
			this.files.updateItem(id);
			this.callEvent("onFileUploadError", [item, ""]);
		}
	},
	html5: {
		$render: function(config) {
			if (this._upload_area){
				//firstChild is smdui_el_box container, which have relative position
				//as result, file control is placed under the button and not in the top corner
				this._contentobj.firstChild.appendChild(this._upload_area);
				return;
			}
			this.files.attachEvent("onBeforeDelete", this._stop_file);

			var input_config =  {
				"type": "file",
				"class": "smdui_hidden_upload",
				tabindex:-1
			};

			if (this._settings.accept)
				input_config.accept = this._settings.accept;

			if (this._settings.multiple)
				input_config.multiple = "true";

			if (this._settings.directory) {
				input_config.webkitdirectory = "true";
				input_config.mozdirectory = "true";
				input_config.directory = "true";
			}

			var f = smdui.html.create("input", input_config);
			this._upload_area = this._contentobj.firstChild.appendChild(f);

			smdui._event(this._viewobj, 'drop', smdui.bind(function(e) {
				this._drop(e);
				smdui.html.preventEvent(e);
			}, this));
			smdui._event(f, 'change', smdui.bind(function() {
				this._add_files(f.files);

				if (smdui.env.isIE) {
					var t = document.createElement("form");
					t.appendChild(this._upload_area);
					t.reset();
					this._contentobj.firstChild.appendChild(f);
				} else
					f.value = "";
			}, this));
			smdui._event(this._viewobj, "click", smdui.bind(function() {
				var now_date = new Date();
				if (now_date - (this._upload_timer_click || 0) > 250) {
					this.fileDialog();
				}
			}, this));

			smdui._event(this._viewobj, 'dragenter', smdui.html.preventEvent);
			smdui._event(this._viewobj, 'dragexit', smdui.html.preventEvent);
			smdui._event(this._viewobj, 'dragover', smdui.html.preventEvent);
		},
		_directoryEntry: function(value) {
			return value.isDirectory;
		},
		_directoryDrop: function(item, state, path) {
			if (item.isFile){
				item.file(function(file){
					state.addFile(file, null, null, { name : path+"/"+file.name });
				});
			} else if (item.isDirectory) {
				// Get folder contents
				var dirReader = item.createReader();
				dirReader.readEntries(function(entries){
					for (var i = 0; i < entries.length; i++){
						state._directoryDrop(entries[i], state, (path ? (path + "/") : "") + item.name);
					}
				});
			}
		},
		// adding files by drag-n-drop
		_drop: function(e) {
			var files = e.dataTransfer.files;
			var items = e.dataTransfer.items;

			if (this.callEvent('onBeforeFileDrop', [files, e])) {
				for (var i = 0; i < items.length; i++) {
					//https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/webkitGetAsEntry
					var item = items[i];
					if (this._settings.directory && item.webkitGetAsEntry){
						item = item.webkitGetAsEntry();
						if (item.isDirectory){
							this._directoryDrop(item, this, "");
							continue;
						}
					}
					this.addFile(files[i]);
				}
			}
			this.callEvent("onAfterFileDrop", [files, e]);
		},
		fileDialog:function(context){
			this._upload_timer_click = new Date();
			this._last_file_context = context;
			var inputs = this._viewobj.getElementsByTagName("INPUT");
			inputs[inputs.length-1].click();
		},
		send: function(id){
			//alternative syntx send(callback)
			if (typeof id == "function"){
				this._last_assigned_upload_callback = id;
				id = 0;
			}

			if (!id){
				var order = this.files.data.order;
				var complete = true;

				if (order.length)
					for (var i=0; i<order.length; i++)
						complete = (!this.send(order[i])) && complete;

				if (complete)
					this._upload_complete();

				return;
			}

			var item = this.files.getItem(id);
			if (item.status !== 'client') return false;

			smdui.assert(this._settings.upload, "You need to define upload url for uploader component");
			item.status = 'transfer';

			var formData = new FormData();

			if (item.folder) {
				for (var i = 0; i < item.folder.length; i++){
					formData.append(this.config.inputName + i, item.folder[i], item.folder[i].webkitRelativePath);
				}
			} else {
				formData.append(this.config.inputName, item.file, item.name);
				if (this._settings.directory)
					formData.append(this.config.inputName+"_fullpath", item.name);
			}

			var headers = {};
			var details = smdui.extend(item.formData||{},this._settings.formData||{});

			var xhr = new XMLHttpRequest();
			var url = this._get_active_url(item);
			if(smdui.callEvent("onBeforeAjax",["POST", url, details, xhr, headers, formData])){
				for (var key in details)
					formData.append(key, details[key]);

				item.xhr = xhr;

				xhr.upload.addEventListener('progress', smdui.bind(function(e){ this.$updateProgress(id, e.loaded/e.total*100); }, this), false);
				xhr.onload = smdui.bind(function(e){ if (!xhr.aborted) this._file_complete(id); }, this);
				xhr.open('POST', url, true);

				for (var key in headers)
					xhr.setRequestHeader(key, headers[key]);

				xhr.send(formData);
			}

			this.$updateProgress(id, 0);
			return true;
		},

		
		_file_complete: function(id) {
			var item = this.files.getItem(id);
			if (item){
				var response = null;
				if(item.xhr.status < 400){
					response = smdui.DataDriver[this._settings.datatype||"json"].toObject(item.xhr.responseText);
				}
				if (!response || response.status == "error"){
					item.status = "error";
					delete item.percent;
					this.files.updateItem(id);
					this.callEvent("onFileUploadError", [item, response]);
				} else {
					this._complete(id, response);
				}
				delete item.xhr;
			}
		},
		stopUpload: function(id){
			smdui.bind(this._stop_file,this.files)(id);
		},
		_stop_file: function(id) {
			var item = this.getItem(id);
			if (typeof(item.xhr) !== 'undefined'){
				item.xhr.aborted = true;
				item.xhr.abort();
				delete item.xhr;
				item.status = "client";
			}
		}
	}
};

smdui.protoUI({
	name:"uploader",
	defaults:{
		autosend:true,
		multiple:true,
		inputName:"upload"
	},
	$cssName:"button",
	_allowsClear:true,
	on_click:{
		//don't fire extra onItemClick events, visible button will do it
		"smdui_hidden_upload":function(){ return false; }
	},
	//will be redefined by upload driver
	send:function(){},
	fileDialog:function(){},
	stopUpload:function(){},

	$init:function(config){
		var driver = smdui.UploadDriver.html5;
		this.files = new smdui.DataCollection();

		// browser doesn't support XMLHttpRequest2
		if (smdui.isUndefined(XMLHttpRequest) || smdui.isUndefined((new XMLHttpRequest()).upload))
			driver = smdui.UploadDriver.flash;

		smdui.assert(driver,"incorrect driver");
		smdui.extend(this, driver, true);
	},
	$setSize:function(x,y){
		if (smdui.ui.view.prototype.$setSize.call(this,x,y)){
			this.render();
		}
	},
	apiOnly_setter:function(value){
		smdui.delay(this.render, this);
		return (this.$apiOnly=value);
	},
	_add_files: function(files){
		for (var i = 0; i < files.length; i++)
			this.addFile(files[i]);

	},
	link_setter:function(value){
		if (value)
			smdui.delay(function(){
				var view = smdui.$$(this._settings.link);
				if (!view){
					var top = this.getTopParentView();
					if (top.$$)
						view = top.$$(this._settings.link);
				}

				if (view.sync && view.filter)
					view.sync(this.files);
				else if (view.setValues)
					this.files.data.attachEvent("onStoreUpdated", function(){
						view.setValues(this);
					});
				view._settings.uploader = this._settings.id;
			}, this);
		return value;
	},
	addFile:function(name, size, type, extra){
		var file = null;
		if (typeof name == "object"){
			file = name;
			name = file.name;
			size = file.size;
		}

		var format = this._format_size(size);
		type = type || name.split(".").pop();

		var file_struct = {
			file: file,
			name: name,
			id: smdui.uid(),
			size: size,
			sizetext: format,
			type: type,
			context: this._last_file_context,
			status: "client"
		};

		if (this._settings.directory && file.webkitRelativePath)
			file_struct.name = file.webkitRelativePath;

		if (extra)
			smdui.extend(file_struct, extra, true);

		if (this.callEvent("onBeforeFileAdd", [file_struct])){
			if (!this._settings.multiple)
				this.files.clearAll();

			var id = this.files.add(file_struct);
			this.callEvent("onAfterFileAdd", [file_struct]);
			if (id && this._settings.autosend)
				this.send(id);
		}
		
		return file_struct;
	},
	
	_get_active_url:function(item){
		var url = this._settings.upload;
		var urldata = smdui.extend(item.urlData||{},this._settings.urlData||{});
		if (url && urldata){
			var subline = [];
			for (var key in urldata)
				subline.push(encodeURIComponent(key)+"="+encodeURIComponent(urldata[key]));

			if (subline.length)
				url += ((url.indexOf("?") ==-1) ? "?" : "&") + subline.join("&");
		}
		return url;
	},

	addDropZone:function(id, hover_text){
		var node = smdui.toNode(id);
		var extra_css = "";
		if (hover_text)
			extra_css = " "+smdui.html.createCss({ content:'"'+hover_text+'"' }, ":before");

		var fullcss = "smdui_drop_file"+extra_css;
		var timer = null;

		//web
		smdui._event(node,"dragover", smdui.html.preventEvent);
		smdui._event(node,"dragover", function(e){
			smdui.html.addCss(node, fullcss, true);
			if (timer){
				clearTimeout(timer);
				timer = null;
			}
		});
		smdui._event(node,"dragleave", function(e){
			//when moving over html child elements
			//browser will issue dragleave and dragover events
			//ignore first one
			timer = setTimeout(function(){
				smdui.html.removeCss(node, fullcss);
			}, 150);
		});

		smdui._event(node,"drop", smdui.bind(function(e){
			smdui.html.removeCss(node, fullcss);
			this._drop(e);
			return smdui.html.preventEvent(e);
		}, this));
	},
	
	_format_size: function(size) {
		var index = 0;
		while (size > 1024){
			index++;
			size = size/1024;
		}
		return Math.round(size*100)/100+" "+smdui.i18n.fileSize[index];
	},

	_complete: function(id, response) {
		if (response.status != 'error') {
			var item = this.files.getItem(id);

			item.status = "server";
			item.progress = 100;
			smdui.extend(item, response, true);

			this.callEvent("onFileUpload", [item, response]);
			this.callEvent("onChange", []);
			this.files.updateItem(id);
		}
		
		if (this.isUploaded())
			this._upload_complete(response);
	},
	_upload_complete:function(response){
		this.callEvent("onUploadComplete", [response]);
		if (this._last_assigned_upload_callback){
			this._last_assigned_upload_callback.call(this, response);
			this._last_assigned_upload_callback = 0;
		}
	},
	isUploaded:function(){
		var order = this.files.data.order;
		for (var i=0; i<order.length; i++)
			if (this.files.getItem(order[i]).status != "server")
				return false;

		return true;
	},
	$onUploadComplete: function(){

	},
	$updateProgress: function(id, percent) {
		var item = this.files.getItem(id);
		item.percent = Math.round(percent);
		this.files.updateItem(id);
	},
	setValue:function(value){
		if (typeof value == "string" && value)
			value = { value:value, status:"server" };

		this.files.clearAll();
		if (value)
			this.files.parse(value);

		this.callEvent("onChange", []);
	},
	getValue:function(){
		var data = [];
		this.files.data.each(function(obj){
			if (obj.status == "server")
				data.push(obj.value||obj.name);
		});

		return data.join(",");
	}

}, smdui.ui.button);

smdui.html.addMeta = function(name, value){
	document.getElementsByTagName('head').item(0).appendChild(smdui.html.create("meta",{
		name:name,
		content:value
	}));	
	
};

(function(){
	
var orientation = function(){
	var new_orientation = !!(window.orientation%180);
	if (smdui.ui.orientation === new_orientation) return;
	smdui.ui.orientation = new_orientation;	
	smdui.callEvent("onRotate", [new_orientation]);
};
if(smdui.env.touch){
	smdui.ui.orientation = !!((smdui.isUndefined(window.orientation)?90:window.orientation)%180);
	smdui.event(window, ("onorientationchange" in window ?"orientationchange":"resize"), orientation);
}


if(smdui.env.isFF && window.matchMedia){
	window.matchMedia("(orientation: portrait)").addListener(function() {smdui.ui.orientation = false; });
	window.matchMedia("(orientation: landscape)").addListener(function() { smdui.ui.orientation = true; });
}
smdui.ui.fullScreen = function(){
	if (!smdui.env.touch) return;

	smdui.html.addMeta("apple-mobile-web-app-capable","yes");
	smdui.html.addMeta("viewport","initial-scale=1, maximum-scale=1, user-scalable=no");

	//in ios5 we can have empty offsetHeight just after page loading
	var size = document.body.offsetHeight||document.body.scrollHeight;

	var iphone = navigator.userAgent.indexOf("iPhone")!=-1;
	var ipad = navigator.userAgent.indexOf("iPad")!=-1;

	var version = navigator.userAgent.match(/iPhone OS (\d+)/);
	var iOS7 = version&&(version[1]>=7);


    var iphone_safari = iphone && (size == 356 || size == 208 || size == 306 || size == 158 || size == 444);
    var iphone5 = (window.screen.height==568);

	var fix = function(){
		var x = 0; var y=0;
		if (iphone && !iOS7){
			if (!smdui.ui.orientation){
				x = 320;
                y = iphone5?(iphone_safari?504:548):(iphone_safari?416:460);
			} else {
                x = iphone5?568:480;
				y = iphone_safari?268:300;
			}
		} else if (smdui.env.isAndroid){

			if(!smdui.env.isFF){
				//ipad doesn't change orientation and zoom level, so just ignore those lines
				document.body.style.width = document.body.style.height = "1px";
				document.body.style.overflow="hidden";

				var dmod = window.outerWidth/window.innerWidth; //<1
				x = window.outerWidth/dmod;
				y = window.outerHeight/dmod;
			}
		} else if(!smdui.env.isIEMobile){
			x = window.innerWidth;
			y = window.innerHeight;
		}

		if (y){
			document.body.style.height = y+"px";
			document.body.style.width = x+"px";
		}

		smdui.ui.$freeze = false;
		smdui.ui.resize();
	};

	var onrotate = function(){ 
		smdui.ui.$freeze = true;
		if(smdui.env.isSafari) 
			fix();
		else
			smdui.delay(fix,null, [], 500);
	};


	smdui.attachEvent("onRotate", onrotate);
	orientation();
	smdui.delay(onrotate);

};


})();

/*
	Behavior:History - change multiview state on 'back' button

 */

smdui.history = {
	track:function(id, url){
		this._init_state(id, url);
		
		if (this._aHandler)
			smdui.$$(this._aViewId).detachEvent(this._aHandler);

		if (id){
			this._aViewId = id;
			var view = smdui.$$(id);
			
			var handler = function(){
				if (smdui.history._ignored) return;

				if (view.getValue)
					smdui.history.push(id, view.getValue());
			};

			if (view.getActiveId)
				this._aHandler = view.attachEvent("onViewChange", handler);
			else
				this._aHandler = view.attachEvent("onChange", handler);
		}
	},
	_set_state:function(view, state){
		smdui.history._ignored = 1;

		view = smdui.$$(view);
		if (view.callEvent("onBeforeHistoryNav", [state]))
			if (view.setValue)
				view.setValue(state);

		smdui.history._ignored = 0;
	},
	push:function(view, url, value){
		view = smdui.$$(view);
		var new_url = "";
		if (url)
			new_url = "#!/"+url;
		if (smdui.isUndefined(value)){
			if (view.getValue)
				value = view.getValue();
			else
				value = url;
		}

		window.history.pushState({ smdui:true, id:view._settings.id, value:value }, "", new_url);
	},
	_init_state:function(view, url){
		smdui.event(window, "popstate", function(ev){
			if (ev.state && ev.state.smdui){
				smdui.history._set_state(ev.state.id, ev.state.value);
			}
		});

		var state = window.location.hash;
		smdui.noanimate = true;
		if (state && state.indexOf("#!/") === 0)
			smdui.history._set_state(view, state.replace("#!/",""));
		else if (url){
			smdui.history.push(view, url);
			smdui.history._set_state(view, url);
		}
		smdui.noanimate = false;
		
		this._init_state = function(){};
	}
};

smdui.protoUI({
	name:"slider",
    $touchCapture:true,
    defaults:{
        min:0,
        max:100,
        value:50,
        step:1,
        title:false,
		template:function(obj, common){
            var id = common._handle_id = "x" +smdui.uid();
            var html = "<div class='smdui_slider_title'></div><div class='smdui_slider_box'><div class='smdui_slider_left'>&nbsp;</div><div class='smdui_slider_right'></div><div class='smdui_slider_handle' role='slider' aria-label='"+obj.label+(obj.title?(" "+obj.title(obj)):"")+"' aria-valuemax='"+obj.max+"' aria-valuemin='"+obj.min+"' aria-valuenow='"+obj.value+"' tabindex='0' id='"+id+"'>&nbsp;</div></div>";
            return common.$renderInput(obj, html, id);
		}
	},
	type_setter:function(type){
		this._viewobj.className += " smdui_slider_"+type;
	},
    title_setter:function(value){
        if (typeof value == 'string')
            return smdui.template(value);
        return value;
    },
    _get_slider_handle:function(){
		return this.$view.querySelector(".smdui_slider_handle");
    },
    _set_inner_size:function(){
        var handle = this._get_slider_handle();
        var config = this._settings;

        //10 - padding of smdui_slider_box ( 20 = 10*2 )
        //8 - width of handle / 2

	    if(handle){    //view is rendered for sure
            var width = this._get_input_width(config);

	        var value = config.value%config.step?(Math.round(config.value/config.step)*config.step):config.value;
	        value =  Math.max(Math.min(value,config.max),config.min);
            var max = config.max - config.min;
            var left = Math.ceil((width - 2 * this._sliderPadding) * (value-config.min) / max);
            var right = width - 2 * this._sliderPadding - left;

            handle.style.left = this._sliderPadding + left - this._sliderHandleWidth / 2 + "px";
            handle.parentNode.style.width = width+"px";
	        //1px border
	        right = Math.min(Math.max(right, 2 * this._sliderBorder),width - this._sliderPadding * 2 - 2 * this._sliderBorder);
	        left = Math.min(Math.max(left, 2 * this._sliderBorder),width - this._sliderPadding * 2 - 2 * this._sliderBorder);
	        //width for left and right bars
            var part = handle.previousSibling;
            part.style.width = right + "px";
            var last = part.previousSibling;
            last.style.width = left + "px";

            if (this._settings.title){
                handle.parentNode.previousSibling.innerHTML = this._settings.title(this._settings, this);
            }
        }
    },
    _set_value_now:function(){
        this._get_slider_handle().setAttribute("aria-valuenow", this._settings.value);
    },
    refresh:function(){
		var handle =  this._get_slider_handle();
		if(handle){
			this._set_value_now();
			if(this._settings.title)
				handle.setAttribute("aria-label", this._settings.label+" "+this._settings.title(this._settings, this));

			this._set_inner_size();
		}
    },
    $setValue:function(){
        this.refresh();
    },
    $getValue:function(){
        return this._settings.value;
    },
    $init:function(){
        if(smdui.env.touch)
            this.attachEvent("onTouchStart" , smdui.bind(this._on_mouse_down_start, this));
        else
            smdui._event(this._viewobj, "mousedown", smdui.bind(this._on_mouse_down_start, this));

        smdui._event( this.$view, "keydown", smdui.bind(this._handle_move_keyboard, this));
    },
    $skin: function(){
		this._sliderHandleWidth = smdui.skin.$active.sliderHandleWidth; //8 - width of handle / 2
		this._sliderPadding = smdui.skin.$active.sliderPadding;//10 - padding of smdui_slider_box ( 20 = 10*2 )
		this._sliderBorder = smdui.skin.$active.sliderBorder;//1px border
    },
    _handle_move_keyboard:function(e){
        var code = e.keyCode, c = this._settings, value = c.value;

        if(code>32 && code <41){

            smdui.html.preventEvent(e);
           
            var trg = e.target || e.srcElement;
            var match =  /smdui_slider_handle_(\d)/.exec(trg.className);
            this._activeIndex = match?parseInt(match[1],10):-1;
            if(match)
                value = c.value[this._activeIndex];
            value = value<c.min ? c.min:(value>c.max ? c.max : value);
            
            if(code === 35) value = c.min;
            else if(code === 36) value = c.max;
            else{
                var inc = (code === 37 || code ===40 || code === 34)?-1:1;
                if(code === 33 || code === 34 || c.step>1)
                    inc = inc*c.step;
                value = value*1+inc;
            }


            if(value>=c.min && value <=c.max){
                if(match){
                    var temp =[];
                    for(var i=0; i<c.value.length; i++)
                        temp[i] = i === this._activeIndex ? value : c.value[i];
                    value = temp;
                }
                this.setValue(value);
                this._activeIndex = -1;
            }
        }
    },
    _on_mouse_down_start:function(e){
        var trg = e.target || e.srcElement;
	    if(this._mouse_down_process){
		    this._mouse_down_process(e);
	    }

	    var value = this._settings.value;
	    if(smdui.isArray(value))
		    value = smdui.copy(value);

        if (trg.className.indexOf("smdui_slider_handle")!=-1){
            this._start_value = value;
            return this._start_handle_dnd.apply(this,arguments);
        } else if (trg.className.indexOf("smdui_slider") != -1){
            this._start_value = value;

            this._settings.value = this._get_value_from_event.apply(this,arguments);

            this._start_handle_dnd(e);
        }
    },
    _start_handle_dnd:function(e){
	    if(smdui.env.touch){
		    this._handle_drag_events = [
			    this.attachEvent("onTouchMove" , smdui.bind(this._handle_move_process, this)),
		        this.attachEvent("onTouchEnd"  , smdui.bind(this._handle_move_stop, this))
		    ];
	    }
		else
	        this._handle_drag_events = [
	            smdui.event(document.body, "mousemove", smdui.bind(this._handle_move_process, this)),
	            smdui.event(window, "mouseup", smdui.bind(this._handle_move_stop, this))
	        ];
        smdui.html.addCss(document.body,"smdui_noselect");
    },
    _handle_move_stop:function(e){
        //detach event handlers
	    if(this._handle_drag_events){
		    if(smdui.env.touch){
			    smdui.detachEvent(this._handle_drag_events[0]);
			    smdui.detachEvent(this._handle_drag_events[1]);
		    }
		    else{
			    smdui.eventRemove(this._handle_drag_events[0]);
			    smdui.eventRemove(this._handle_drag_events[1]);
		    }
		    this._handle_drag_events = [];
	    }

        smdui.html.removeCss(document.body,"smdui_noselect");

        var value = this._settings.value;

	    if(smdui.isArray(value))
		    value = smdui.copy(value);

	    this._settings.value = this._start_value;
        this.setValue(value);

        this._get_slider_handle(this._activeIndex).focus();
        this._activeIndex = -1;
    },
    _handle_move_process:function(e){
        this._settings.value = this._get_value_from_event.apply(this,arguments);
        this.refresh();
        this.callEvent("onSliderDrag", []);
    },
	_get_value_from_event:function(event,touchContext){
		// this method takes 2 arguments in case of touch env
		var pos = 0;
		if(smdui.env.touch){
			pos = touchContext?touchContext.x: event.x;
		}
		else
			pos = smdui.html.pos(event).x;
		return this._get_value_from_pos(pos);
	},
    _get_value_from_pos:function(pos){
        var config = this._settings;
        //10 - padding of slider box
        var max = config.max - config.min;
        var left = smdui.html.offset(this._get_slider_handle().parentNode).x + this._sliderPadding;
	    var width = this._get_input_width(config) - 2 * this._sliderPadding;
	    var newvalue = (width?(pos-left) * max / width:0);
        newvalue = Math.round((newvalue+config.min)/config.step) * config.step;
        return Math.max(Math.min(newvalue, config.max), config.min);
    },
    _init_onchange:function(){} //need not ui.text logic
}, smdui.ui.text);

smdui.protoUI({
	name:"rangeslider",
	$cssName:"slider smdui_rangeslider",
	defaults:{
		separator: ",",
		value: "20,80",
		template:function(obj, common){
			var id = "x" + smdui.uid();
			common._handle_id = [id+"_0",id+"_1"];

			var aria = "role='slider' aria-label='"+obj.label+(obj.title?(" "+obj.title(obj)):"")+"' aria-valuemax='"+obj.max+"' aria-valuemin='"+obj.min+"' tabindex='0'";
			var handles = "<div class='smdui_slider_handle smdui_slider_handle_0' id='"+common._handle_id[0]+"' "+aria+" aria-valuenow='"+obj.value[0]+"'>&nbsp;</div>";
			handles += "<div class='smdui_slider_handle smdui_slider_handle_1' id='"+common._handle_id[1]+"' "+aria+" aria-valuenow='"+obj.value[1]+"'>&nbsp;</div>";
			var html = "<div class='smdui_slider_title'></div><div class='smdui_slider_box'><div class='smdui_slider_right'>&nbsp;</div><div class='smdui_slider_left'></div>"+handles+"</div>";
			return common.$renderInput(obj, html, id);
		}
	},
	value_setter: function(value){

		if(!smdui.isArray(value)){
			value = value.toString().split(this._settings.separator);
		}
		if(value.length <2)
			value[1] = value[0];
		value[0] = parseFloat(value[0]);
		value[1] = parseFloat(value[1]);
		return value;
	},
	_get_slider_handle:function(index){
		index = index && index>=0?index:0;
		return this.$view.querySelector(".smdui_slider_handle_"+(index||0));
	},
	_get_left_pos: function(width,index){
		var config, max, value;

		config = this._settings;
		max = config.max - config.min;
		value = config.value[index]%config.step?(Math.round(config.value[index]/config.step)*config.step):config.value[index];
		value =  Math.max(Math.min(value,config.max),config.min);
		return Math.ceil((width - 20) * (value-config.min) / max);
	},
	_set_inner_size:function(){
		var config, handle0,  handle1,
			left0, left1, parentBox, width;

		handle0 =this._get_slider_handle(0);
		handle1 = this._get_slider_handle(1);
		config = this._settings;

		if(!smdui.isArray(config.value)){
			this.define("value",config.value);
		}
		//10 - padding of smdui_slider_box ( 20 = 10*2 )
		//8 - width of handle / 2

		if (handle0){

			width = this._get_input_width(config);

			parentBox = handle0.parentNode;
			parentBox.style.width =  width+"px";

			left0 = this._get_left_pos(width, 0);
			left1 = this._get_left_pos(width, 1);

			handle0.style.left = 10 + left0 - 8 + "px";
			handle1.style.left = 10 + left1 - 8 + "px";

			parentBox.firstChild.style.width = width - 22+ "px";

			parentBox.childNodes[1].style.width = left1 - left0 + "px";
			parentBox.childNodes[1].style.left = left0+12 + "px";


			if (this._settings.title){
				handle0.parentNode.previousSibling.innerHTML = this._settings.title(this._settings, this);
			}
		}
	},
	_set_value_now:function(){
		for(var i=0; i<2; i++){
			this._get_slider_handle(i).setAttribute("aria-valuenow", this._settings.value[i]);
		}
    },
	_mouse_down_process: function(e){
		var trg = e.target || e.srcElement;
		var match =  /smdui_slider_handle_(\d)/.exec(trg.className);
		this._activeIndex = match?parseInt(match[1],10):-1;

		if(match)
			this._set_handle_active(this._activeIndex);
	},
	setValue:function(value){
		var oldvalue = this._settings.value;

		var temp = (typeof value == "object"?value.join(this._settings.separator):value);

		if (oldvalue.join(this._settings.separator) == temp) return false;

		this._settings.value = value;
		if (this._rendered_input)
			this.$setValue(value);

		this.callEvent("onChange", [value, oldvalue]);
	},
	$getValue:function(){
		var value = this._settings.value;
		return this._settings.stringResult?value.join(this._settings.separator):value;
	},
	_set_handle_active: function(index){
		var hActive = this._get_slider_handle(index);
		var h = this._get_slider_handle(1-index);
		if(hActive.className.indexOf("smdui_slider_active") == -1)
			hActive.className += " smdui_slider_active";
		h.className = h.className.replace(" smdui_slider_active","");
	},
	_get_value_from_pos:function(pos){
		var config = this._settings;
		var value = config.value;
		//10 - padding of slider box
		var max = config.max - config.min;

		var left = smdui.html.offset(this._get_slider_handle().parentNode).x;
		var newvalue = Math.ceil((pos-left) * max / this._get_input_width(config));
		newvalue = Math.round((newvalue+config.min)/config.step) * config.step;

		var index = null;

		var pos0 = smdui.html.offset(this._get_slider_handle(0)).x;
		var pos1 = smdui.html.offset(this._get_slider_handle(1)).x;

		if(pos0==pos1 && (config.value[0] == config.min || config.value[0] == config.max) ){
			index = (config.value[0] == config.min?1:0);
			this._set_handle_active(index);
		}
		else{
			if(this._activeIndex >=0){
				index = this._activeIndex;
			}else{
				if(pos0==pos1){
					index = (pos < pos0?0:1);
				}
				else{
					var dist0 = Math.abs(pos0-pos);
					var dist1 = Math.abs(pos1-pos);
					index = dist0<dist1?0:1;
					this._activeIndex = index;
				}
			}
		}


		if(index){
			value[index] = Math.max(Math.min(newvalue, config.max), value[0]);
		}
		else{
			value[index] = Math.max(Math.min(newvalue, value[1]), config.min);
		}

		return value;
	}
}, smdui.ui.slider);




/*
	view.load("offline->some.php")

	or

	view.load( smdui.proxy("offline", "some.php") );

	or

	view.load( smdui.proxy("offline", "post->url.php") );
*/

smdui.proxy.offline = {
	$proxy:true,

	storage: smdui.storage.local,
	cache:false,
	data:"",

	_is_offline : function(){
		if (!this.cache && !smdui.env.offline){
			smdui.callEvent("onOfflineMode",[]);
			smdui.env.offline = true;
		}
	},
	_is_online : function(){
		if (!this.cache && smdui.env.offline){
			smdui.env.offline = false;
			smdui.callEvent("onOnlineMode", []);
		}
	},

	load:function(view, callback){
		var mycallback = {
			error:function(){
				//assuming offline mode
				var text = this.getCache() || this.data;

				var loader = { responseText: text };
				var data = smdui.ajax.prototype._data(loader);

				this._is_offline();
				smdui.ajax.$callback(view, callback, text, data, loader);
			},
			success:function(text, data, loader){
				this._is_online();
				smdui.ajax.$callback(view, callback, text, data, loader);

				this.setCache(text);
			}
		};

		//in cache mode - always load data from cache
		if (this.cache && this.getCache())
			mycallback.error.call(this);
		else {
			//else try to load actual data first
			if (this.source.$proxy)
				this.source.load(this, mycallback);
			else
				smdui.ajax(this.source, mycallback, this);
		}
	},
	getCache:function(){
		return this.storage.get(this._data_name());
	},
	clearCache:function(){
		this.storage.remove(this._data_name());
	},
	setCache:function(text){
		this.storage.put(this._data_name(), text);
	},
	_data_name:function(){
		if (this.source.$proxy)
			return this.source.source + "_$proxy$_data";
		else 
			return this.source + "_$proxy$_data";
	},
	saveAll:function(view, update, dp, callback){
		this.setCache(view.serialize());
		smdui.ajax.$callback(view, callback, "", update);
	},
	result:function(id, master, dp, text, data){
		for (var i = 0; i < data.length; i++)
			dp.processResult({ id: data[i].id, status: data[i].operation }, {}, {});
	}
};

smdui.proxy.cache = {
	init:function(){
		smdui.extend(this, smdui.proxy.offline);
	},
	cache:true
};

smdui.proxy.local = {
	init:function(){
		smdui.extend(this, smdui.proxy.offline);
	},
	cache:true,
	data:[]
};




smdui.ActiveContent = {
	$init:function(config){  
		if (config.activeContent){
			this.$ready.push(this._init_active_content_list);
			
			this._active_holders = {};
			this._active_holders_item = {};
			this._active_holders_values = {};
			this._active_references = {};
			
			for (var key in config.activeContent){
				this[key] = this._bind_active_content(key);
				if (config.activeContent[key].earlyInit){
					var temp = smdui._parent_cell; smdui._parent_cell = null;
					this[key].call(this,{},this, config.activeContent);
					smdui._parent_cell=temp;
				}
			}
		}
	},
	_destructActiveContent: function(){
		for(var key in this._active_references){
			var elem = this._active_references[key];
			if(elem.destructor)
				elem.destructor();
		}
	},
	_init_active_content_list:function(){
		this.attachEvent("onDestruct",smdui.bind(this._destructActiveContent,this));

		smdui._event(this.$view, "blur", function(ev){
			var target = ev.target || ev.srcElement;

			// for inputs only
			if(target.tagName != "BUTTON"){
				var el = smdui.$$(ev);
				if (el && el !== this && el.getValue  && el.setValue){
					el.getNode(ev);

					var newvalue = el.getValue();
					if (newvalue != el._settings.value)
						el.setValue(newvalue);
				}
			}
		}, {bind:this, capture: true});

		if (this.filter){
			for (var key in this._settings.activeContent){
				this.type[key] = this[key];
				this[key] = this._locate_active_content_by_id(key);
			}
			//really bad!
			this.attachEvent("onBeforeRender", function(){
				this.type.masterUI = this;
			});
			this.type.masterUI = this;
		}
	},
	_locate_active_content_by_id:function(key){
		return function(id){
			var button = this._active_references[key];
			var button_id = button._settings.id;
			var html = this.getItemNode(id).getElementsByTagName("DIV");
			for (var i=0; i < html.length; i++) {
				if (html[i].getAttribute("view_id") == button_id){
					button._viewobj = button._dataobj = html[i];
					break;
				}
			}
			return button;
		};
	},
	_get_active_node:function(el, key, master){
		return function(e){
			if (e){
				var trg=e.target||e.srcElement;
				while (trg){
					if (trg.getAttribute && trg.getAttribute("view_id")){
						master._setActiveContentView(el,trg);
						if (master.locate){
							var id = master.locate(trg.parentNode);
							var value = master._active_holders_values[key][id];
							el._settings.value = value;
							el._settings.$masterId = id;
						}
						return trg;
					}
					trg = trg.parentNode;
				}				
			}
			return el._viewobj;
		};
	},
	_set_new_active_value:function(key, master){
		return function(value){
			var data = master.data;
			if (master.filter){
				var id = master.locate(this._viewobj.parentNode);
				data = master.getItem(id);
				//XMLSerializer - FF "feature"
				this.refresh();
				master._active_holders_item[key][id]=this._viewobj.outerHTML||(new XMLSerializer().serializeToString(this._viewobj));
				master._active_holders_values[key][id] = value;
			}
			if(data)
				data[key] = value;
		};
	},
	_bind_active_content:function(key){ 
		return function(obj, common, active){
			var object = common._active_holders?common:common.masterUI;

			if (!object._active_holders[key]){
				var d = document.createElement("DIV");
				
				active = active || object._settings.activeContent;
				var el = smdui.ui(active[key], d);

				d.firstChild.setAttribute("onclick", "event.processed = true; if (smdui.env.isIE8) event.srcElement.w_view = '"+el._settings.id+"';");

				el.getNode = object._get_active_node(el, key, object);

				el.attachEvent("onChange", object._set_new_active_value(key, object));
				
				object._active_references[key] = el;
				object._active_holders[key] = d.innerHTML;
				object._active_holders_item[key] = {};
				object._active_holders_values[key] = {};
				el.$activeEl = el.$view;
			}
			if (object.filter && obj[key] != object._active_holders_values[key] && !smdui.isUndefined(obj[key])){
				var el = object._active_references[key];
				el.blockEvent();
				object._setActiveContentView(el,el.$activeEl);
				//in IE we can lost content of active element during parent repainting
				if (!el.$view.firstChild) el.refresh();
				el.setValue(obj[key]);
				el.refresh();
				el.unblockEvent();
				
				object._active_holders_values[key][obj.id] = obj[key];
				object._active_holders_item[key][obj.id] = el._viewobj.outerHTML||(new XMLSerializer().serializeToString(el._viewobj));
			}
			
			return object._active_holders_item[key][obj.id]||object._active_holders[key];
		};
	},
	_setActiveContentView: function(el,view){
		el._dataobj = el._viewobj = el.$view = view;
	}
};
smdui.ProgressBar = {
	$init:function(){
		if (smdui.isUndefined(this._progress) && this.attachEvent){
			this.attachEvent("onBeforeLoad", this.showProgress);
			this.attachEvent("onAfterLoad", this.hideProgress);
			this._progress = null;
		}
	},
	showProgress:function(config){
		// { position: 0 - 1, delay: 2000ms by default, css : name of css class to use }
		if (!this._progress){

			config = smdui.extend({
				position:0,
				delay: 2000,
				type:"icon",
				icon:"refresh",
				hide:false
			}, (config||{}), true);

			var incss = (config.type == "icon") ? ("fa-"+config.icon+" fa-spin") : "";



			this._progress = smdui.html.create(
				"DIV",
				{
					"class":"smdui_progress_"+config.type,
					"role":"progressbar",
					"aria-valuemin":"0",
					"aria-valuemax":"100",
					"tabindex":"0"
				},
				"<div class='smdui_progress_state "+incss+"'></div>"
			);

			if(!this.setPosition)
				this._viewobj.style.position = "relative";

			smdui.html.insertBefore(this._progress, this._viewobj.firstChild, this._viewobj);
			this._viewobj.setAttribute("aria-busy", "true");

			if(!smdui.Touch.$active){
				if(this.getScrollState){
					var scroll = this.getScrollState();
					if(this._viewobj.scrollWidth != this.$width){
						this._progress.style.left = scroll.x +"px";
					}
					if(this._viewobj.scrollHeight != this.$height){
						if(config.type != "bottom"){
							this._progress.style.top = scroll.y +"px";
						} else {
							this._progress.style.top =  scroll.y + this.$height - this._progress.offsetHeight +"px";
						}

					}
				}
			}


			this._progress_delay = 1;
		}

		if (config && config.type != "icon")
			smdui.delay(function(){
				if (this._progress){
					var position = config.position || 1;
					//check for css-transition support
					if(this._progress.style[smdui.env.transitionDuration] !== smdui.undefined || !config.delay){
						this._progress.firstChild.style.width = position*100+"%";
						if (config.delay)
							this._progress.firstChild.style[smdui.env.transitionDuration] = config.delay+"ms";
					} else{
					//if animation is not supported fallback to timeouts [IE9]
						var count = 0,
							start = 0,
							step = position/config.delay*30,
							view = this;

						if(this._progressTimer){
							//reset the existing progress
							window.clearInterval(this._progressTimer);
							start = this._progress.firstChild.offsetWidth/this._progress.offsetWidth*100;
						}
						this._progressTimer = window.setInterval(function(){
							if(count*30 == config.delay){
								window.clearInterval(view._progressTimer);
							}
							else{
								if(view._progress && view._progress.firstChild)
									view._progress.firstChild.style.width = start+count*step*position*100+"%";
								count++;
							}
						},30);
					}

					if (config.hide)
						smdui.delay(this.hideProgress, this, [1], config.delay);

				}
				this._progress_delay = 0;
			}, this);
		else if(config && config.type == "icon" && config.hide)
			smdui.delay(this.hideProgress, this, [1], config.delay);
	},
	hideProgress:function(now){
		if (this._progress_delay)
			now = true;

		if (this._progress){
			if (now){
				if(this._progressTimer)
					window.clearInterval(this._progressTimer);
				smdui.html.remove(this._progress);
				this._progress = null;
				this._viewobj.removeAttribute("aria-busy");
			} else {
				this.showProgress({ position:1.1, delay:300 , hide:true });
			}
		}
	}
};
smdui.protoUI({
	name:"multitext",
	$cssName:"text",
	defaults:{
		icon:"plus-circle",
		iconWidth:25,
		separator:", "
	},
	getValueHere:function(){
		return smdui.ui.text.prototype.getValue.call(this);
	},
	setValueHere:function(value){
		return smdui.ui.text.prototype.$setValue.call(this, value);
	},
	getValue:function(){
		if (this.config.mode == "extra") return this.getValueHere();

		var values = [ this.getValueHere(this) ];
		for (var i=0; i<this._subs.length; i++){
			var seg = smdui.$$(this._subs[i]).getValueHere();
			if (seg) values.push(seg);
		}
		return values.join(this.config.separator);
	},
	$setValue:function(value){
		value = value || "";
		if (this._known_value == value) return;

		this._known_value = value;

		if (this.config.mode == "extra") return this.setValueHere(value);

		this.removeSection();
		var parts = value.split(this.config.separator);
		this.setValueHere.call(this, parts[0]);
		for (var i = 1; i<parts.length; i++){
			var next = this.addSection();
			smdui.$$(next).setValueHere(parts[i]);
		}
	},
	_subOnChange:function(call){
		var parent = this.config.master ? smdui.$$(this.config.master) : this;
		var newvalue = parent.getValue();
		var oldvalue = parent._settings.value;
		if (newvalue !== oldvalue){
			parent._settings.value = newvalue;
			parent.callEvent("onChange", [newvalue, oldvalue]);
		}
	},
	addSection:function(){
		var config = this.config,
			newConfig = {
				labelWidth: config.labelWidth,
				inputWidth: config.inputWidth,
				width: config.width,
				label: config.label ? "&nbsp;" : "",
				view: this.name,
				mode: "extra",
				value: "",
				icon: "minus-circle",
				suggest: config.suggest || null,
				master: config.id
			};

		smdui.extend(newConfig, config.subConfig||{},true);

		var newone = this.getParentView().addView(newConfig);
		smdui.$$(newone).attachEvent("onChange", this._subOnChange);

		this._subs.push(newone);
		return newone;
	},
	removeSection:function(id){
		var parent = this.config.master ? smdui.$$(this.config.master) : this;
		for (var i = parent._subs.length - 1; i >= 0; i--){
			var section = parent._subs[i];
			if (!id || section == id){
				parent._subs.removeAt(i);
				this.getParentView().removeView(section);
			}
		}
	},
	on_click:{
		"smdui_input_icon":function(ev, id, html){
			if (this.config.mode == "extra"){
				this.removeSection(this.config.id);
				var childs = this.getParentView().getChildViews();
				childs[childs.length - 1].focus();
				this._subOnChange();
			} else
				smdui.$$( this.addSection() ).focus();

			return false;
		}
	},
	$init:function(){
		this._subs = smdui.toArray([]);
		this.attachEvent("onKeyPress", this._onKeyPress);
	},
	$render:function(obj){
		this.$setValue(obj.value);
	},
}, smdui.ui.text);

smdui.protoUI({
	name:"abslayout",
	$init:function(){
		this.$view.className += " smdui_abslayout";
		delete this.rows_setter;
		delete this.cols_setter;
	},
	cells_setter:function(cells){
		this._collection = cells;
	},
	_parse_cells:function(){
		smdui.ui.baselayout.prototype._parse_cells.call(this, this._collection);
	},
	$getSize:function(dx, dy){
		var self_size = smdui.ui.baseview.prototype.$getSize.call(this, 0, 0);
		var sub = null;

		for (var i=0; i<this._cells.length; i++)
			if (this._cells[i]._settings.relative)
				sub = this._cells[i].$getSize(0,0);

		if (sub){
			//use child settings if layout's one was not defined
			if (self_size[1] >= 100000) self_size[1]=0;
			if (self_size[3] >= 100000) self_size[3]=0;

			self_size[0] = Math.max(self_size[0], sub[0]);
			self_size[1] = Math.max(self_size[1], sub[1]);
			self_size[2] = Math.max(self_size[2], sub[2]);
			self_size[3] = Math.max(self_size[3], sub[3]);
		}

		return self_size;
	},
	$setSize:function(x,y){
		this._layout_sizes = [x,y];
		smdui.debug_size_box_start(this);

		smdui.ui.baseview.prototype.$setSize.call(this,x,y);
		this._set_child_size(x,y);

		smdui.debug_size_box_end(this, [x,y]);
	},
	_set_child_size:function(x,y){
		for (var i=0; i<this._cells.length; i++){
		 var view = this._cells[i];
		 var conf = view._settings;

		 if (conf.relative){
			conf.left = conf.top = 0;
			conf.width = x;
			conf.height = y;
		 }

		 var sizes = view.$getSize(0,0);
		 view.$setSize(sizes[0], sizes[2]);

		 var node = view.$view;
		 var options = ["left", "right", "top", "bottom"];

		 for (var j = 0; j < options.length; j++) {
			var key = options[j];
			if (key in conf)
				node.style[key] = conf[key] + "px";
		 }
		}
	}
}, smdui.ui.baselayout);

smdui.protoUI({
	name:"datalayout",
	$init:function(){
		this.data.provideApi(this, true);
		this.data.attachEvent("onStoreUpdated", smdui.bind(this.render, this));
	},
	_parse_cells:function(cells){
		if (!this._origin_cells){
			this._origin_cells = this._collection;
			this._collection = [{}];
		}

		return smdui.ui.layout.prototype._parse_cells.call(this, this._collection);
	},
	_fill_data:function(view, prop){
		var obj, name = view._settings.name;
		if (name){
			if (name == "$value")
				obj = prop;
			else
				obj = prop[name];

			if (view.setValues) view.setValues(obj);
			else if (view.setValue) view.setValue(obj);
			else if (view.parse){
				//make copy of data for treestore parsers
				if (view.openAll)
					obj = smdui.copy(obj);
				view.parse(obj);
			}
		} else {
			var collection = view._cells;
			if (collection)
				for (var i = 0; i < collection.length; i++)
					this._fill_data(collection[i], prop);
		}
	},
	render:function(id, obj, mode){
		if (id && mode === "update"){
			//update mode, change only part of layout
			var obj = this.getItem(id);
			var index = this.getIndexById(id);

			this._fill_data(this._cells[index], obj);
			return;
		}

		//full repainting
		var cells = this._collection = [];
		var order = this.data.order;
		var subcount = this._origin_cells.length;

		for (var i = 0; i < order.length; i++) {
		if (subcount)
				for (var j = 0; j < subcount; j++)
					cells.push(smdui.copy(this._origin_cells[j]));
			else
				cells.push(this.getItem(order[i]));
		}

		if (!cells.length) cells.push({});

		this.reconstruct();

		if (subcount)
			for (var i = 0; i < order.length; i++) {
				var prop = this.getItem(order[i]);
				for (var j = 0; j < subcount; j++) {
					var view = this._cells[i*subcount + j];
					this._fill_data(view, prop);
				}
			}
	}
}, smdui.DataLoader, smdui.ui.layout);

smdui.protoUI({
	$init:function(){
		smdui.extend(this, smdui.FlexLayout, true);
	},
	name:"flexdatalayout"
}, smdui.ui.datalayout);

/*
	UI:Video
*/

smdui.protoUI({
	name:"video",
	$init:function(config){
		if (!config.id) config.id = smdui.uid();
		this.$ready.push(this._init_video);
	},
	_init_video:function(){
		var c = this._settings;
		this._contentobj  = smdui.html.create("video",{
			"class":"smdui_view_video",
			"style":"width:100%;height:100%;",
			"autobuffer":"autobuffer"
		},"");
		if(c.poster)
			this._contentobj.poster=c.poster;

		if(c.src){
			if(typeof c.src!= "object")
				c.src = [c.src];
			for(var i = 0; i < c.src.length;i++)
				this._contentobj.innerHTML += ' <source src="'+ c.src[i]+'">';
		}
	
		if(c.controls)
			this._contentobj.controls=true;
		if(c.autoplay)
			this._contentobj.autoplay=true;
		this._viewobj.appendChild(this._contentobj);
	},
	getVideo:function(){
		return this._contentobj;
	},
	defaults:{
		src:"",
		controls: true
	}
}, smdui.ui.view);

smdui.protoUI({
	name:"sidemenu",
	defaults: {
		animate: true,
		position: "left",
		width: 200,
		borderless: true
	},
	$init:function(){
		this.$view.className += " smdui_sidemenu";
	},
	$skin:function(){
		this.defaults.padding = 0;
	},
	position_setter: function(value){
		var prevPosition = this._settings.position;
		if(prevPosition)
			smdui.html.removeCss(this.$view," smdui_sidemenu_"+prevPosition);
		smdui.html.addCss(this.$view," smdui_sidemenu_"+value);
		return value;
	},
	$getSize: function(){
		var sizes = smdui.ui.window.prototype.$getSize.apply(this,arguments);
		this._desired_sizes = sizes;
		return sizes;
	},
	$setSize:function(x,y){
		smdui.ui.view.prototype.$setSize.call(this,x,y);
		x = this._content_width-this._settings.padding*2;
		y = this._content_height-this._settings.padding*2;
		this._contentobj.style.padding = this._settings.padding+"px";
		this._headobj.style.display="none";
		this._bodyobj.style.height = y+"px";
		this._body_cell.$setSize(x,y);
	},
	show: function(){
		if(!this.callEvent("onBeforeShow",arguments))
			return false;

		this._settings.hidden = false;
		this._viewobj.style.zIndex = (this._settings.zIndex||smdui.ui.zIndex());
		if (this._settings.modal || this._modal){
			this._modal_set(true);
			this._modal = null; // hidden_setter handling
		}
		this._viewobj.style.display = "block";
		this._render_hidden_views();
		if (this._settings.position)
			this._setPosition();

		this._hide_timer = 1;
		smdui.delay(function(){ this._hide_timer = 0; }, this, [], (smdui.env.touch ? 400 : 100 ));

		if (this.config.autofocus){
			this._prev_focus = smdui.UIManager.getFocus();
			smdui.UIManager.setFocus(this);
		}

		if (-1 == smdui.ui._popups.find(this))
			smdui.ui._popups.push(this);

		this.callEvent("onShow",[]);
	},
	_setPosition: function(x){
		var width, height, maxWidth, maxHeight,
			position,
			left = 0, top = 0,
			state = { };


		this.$view.style.position = "fixed";

		maxWidth = (window.innerWidth||document.documentElement.offsetWidth);
		maxHeight = (window.innerHeight||document.documentElement.offsetHeight);

		width = this._desired_sizes[0] || maxWidth;
		height = this._desired_sizes[2] ||maxHeight;

		smdui.assert(width &&height, "Attempt to show not rendered window");

		position = this._settings.position;

		if(position == "top"){
			width = maxWidth;
		} else if(position == "right"){
			height = maxHeight;
			left = maxWidth - width;
		} else if(position == "bottom"){
			width = maxWidth;
			top = maxHeight - height;
		} else {
			height = maxHeight;
		}

		state = { left: left, top: top,
			width: width, height: height,
			maxWidth: maxWidth, maxHeight: maxHeight
		};

		if (typeof this._settings.state == "function")
			this._settings.state.call(this, state);

		this._state = state;

		this.$setSize(state.width, state.height);

		if (typeof x == "undefined" && this._isAnimationSupported()){
			smdui.html.removeCss(this.$view,"smdui_animate",true);
			// set initial state
			this._animate[this._settings.position].beforeShow.call(this, state);
			// set apply animation css
			smdui.delay(function(){
				smdui.html.addCss(this.$view,"smdui_animate",true);
			},this, null,1);
			// animate popup
			smdui.delay(function(){
				this._animate[this._settings.position].show.call(this, state);
			},this, null,10);

		}
		else{

			this.setPosition(state.left, state.top);
		}
	},
	_isAnimationSupported: function(){
		return smdui.animate.isSupported() && this._settings.animate && !(smdui.env.isIE && navigator.appVersion.indexOf("MSIE 9")!=-1);
	},
	hidden_setter:function(value){
		if(value)
			this.hide(true);
		else
			this.show();
		return !!value;
	},
	_animate:{
		left: {
			beforeShow: function(state){
				this.$view.style.left = -state.width+"px";
				this.$view.style.top = state.top+"px";
			},
			show: function(){
				this.$view.style.left = "0px";
			},
			hide: function(state){
				this.$view.style.left = -state.width+"px";
			}
		},
		right: {
			beforeShow: function(state){
				this.$view.style.left = "auto";
				this.$view.style.right = -state.width+"px";
				this.$view.style.top = state.top+"px";
			},
			show: function(){
				this.$view.style.right = 0 +"px";
			},
			hide: function(state){
				this.$view.style.right = -state.width+"px";
			}
		},
		top: {
			beforeShow: function(state){
				this.setPosition(state.left,state.top);
				this.$view.style.height ="0px";
				this._bodyobj.style.height ="0px";
			},
			show: function(state){
				this.$view.style.height = state.height +"px";
				this._bodyobj.style.height =state.height+"px";
			},
			hide: function(){
				this.$view.style.height = "0px";
				this._bodyobj.style.height = "0px";
			}
		},
		bottom: {
			beforeShow: function(state){
				this.$view.style.left = state.left + "px";
				this.$view.style.top = "auto";
				var bottom = (state.bottom != smdui.undefined?state.bottom:(state.maxHeight-state.top  -state.height));
				this.$view.style.bottom = bottom +"px";
				this.$view.style.height ="0px";
			},
			show: function(state){
				this.$view.style.height = state.height +"px";
			},
			hide: function(){
				this.$view.style.height = "0px";
			}
		}
	},
	hide:function(force){

		if (this.$destructed) return;

		if (this._settings.modal)
			this._modal_set(false);

		var maxWidth = (window.innerWidth||document.documentElement.offsetWidth);
		var maxHeight = (window.innerHeight||document.documentElement.offsetHeight);

		if (!force && this._isAnimationSupported() && maxWidth == this._state.maxWidth && maxHeight == this._state.maxHeight){
			// call 'hide' animation handler
			this._animate[this._settings.position].hide.call(this, this._state);
			// hide popup
			var tid = smdui.event(this.$view, smdui.env.transitionEnd, smdui.bind(function(ev){
				this._hide_callback();
				smdui.eventRemove(tid);
			},this));
		}
		else{
			this._hide_callback();
		}

		if (this._settings.autofocus){
			var el = document.activeElement;
			if (el && this._viewobj && this._viewobj.contains(el)){
				smdui.UIManager.setFocus(this._prev_focus);
				this._prev_focus = null;
			}
		}

		this._hide_sub_popups();

	}

}, smdui.ui.popup);

(function(){

	var smduiCustomScroll = smdui.CustomScroll = {
		scrollStep:40,
		init:function(){
			this._init_once();
			smdui.env.$customScroll = true;
			smdui.ui.scrollSize = 0;
			smdui.destructors.push({
				obj:{
					destructor:function(){
						this._last_active_node = null;
					}
				}
			});
			smdui.attachEvent("onReconstruct", smduiCustomScroll._on_reconstruct);
			smdui.attachEvent("onResize", smduiCustomScroll._on_reconstruct);

			//adjusts scroll after view repainting
			//for example, opening a branch in the tree
			//it will be better to handle onAfterRender of the related view
			smdui.attachEvent("onClick", smduiCustomScroll._on_reconstruct);
		},
		resize:function(){
			this._on_reconstruct();
		},
		_enable_datatable:function(view){
			view._body._custom_scroll_view = view._settings.id;
			view.attachEvent("onAfterRender", function(){
				var scroll = smduiCustomScroll._get_datatable_sizes(this);
				var y = Math.max(scroll.dy - scroll.py, 0);
				var x = Math.max(scroll.dx - scroll.px, 0);

				if (this._y_scroll && this._scrollTop > y){
					this._y_scroll.scrollTo(y);
				}
				else if (this._x_scroll && this._scrollLeft > x){
					this._x_scroll.scrollTo(x);
				}

				if ( smduiCustomScroll._last_active_node == this._body)
				 	smduiCustomScroll._on_reconstruct();
			});
			smdui._event(view._body, "mouseover", 	smduiCustomScroll._mouse_in 		);
			smdui._event(view._body, "mouseout", 	smduiCustomScroll._mouse_out		);
		},
		enable:function(view, mode){ 
			smduiCustomScroll._init_once();
			if (view.mapCells)
				return this._enable_datatable(view);

			var node = view;
			if (view._dataobj)
				node = view._dataobj.parentNode;
			
			node._custom_scroll_mode = mode||"xy";
			smdui._event(node, "mouseover", 	smduiCustomScroll._mouse_in 		);
			smdui._event(node, "mouseout", 	smduiCustomScroll._mouse_out		);
			smdui._event(node, "mousewheel", 	smduiCustomScroll._mouse_wheel	);
			smdui._event(node, "DOMMouseScroll", 	smduiCustomScroll._mouse_wheel	);

			// update scroll on data change
			this._setDataHandler(view);
		},
		_on_reconstruct:function(){
			var last = smduiCustomScroll._last_active_node;
			if (last && last._custom_scroll_size){
				smduiCustomScroll._mouse_out_timed.call(last);
				smduiCustomScroll._mouse_in.call(last);
			}			
		},
		_init_once:function(e){
			smdui.event(document.body, "mousemove", 	function(e){
				if (smduiCustomScroll._active_drag_area)
					smduiCustomScroll._adjust_scroll(smduiCustomScroll._active_drag_area, smduiCustomScroll._active_drag_area._scroll_drag_pos, smdui.html.pos(e));
			});
			smduiCustomScroll._init_once = function(){};
		},
		_mouse_in:function(e){
			smduiCustomScroll._last_active_node  = this;

			clearTimeout(this._mouse_out_timer);
			if (this._custom_scroll_size || smduiCustomScroll._active_drag_area) return;
			
			var sizes;
			if (this._custom_scroll_view){
				//ger related view
				var view = smdui.$$(this._custom_scroll_view);
				//if view was removed, we need not scroll anymore
				if (!view) return;
				sizes = smduiCustomScroll._get_datatable_sizes(view);
			} else{
				sizes = {
					dx:this.scrollWidth,
					dy:this.scrollHeight,
					px:this.clientWidth,
					py:this.clientHeight
				};
				sizes._scroll_x = sizes.dx > sizes.px && this._custom_scroll_mode.indexOf("x") != -1;
				sizes._scroll_y = sizes.dy > sizes.py && this._custom_scroll_mode.indexOf("y") != -1;
			}

			this._custom_scroll_size = sizes;
			if (sizes._scroll_x){
				sizes._scroll_x_node = smduiCustomScroll._create_scroll(this, "x", sizes.dx, sizes.px, "width", "height");
				sizes._sx = (sizes.px - sizes._scroll_x_node.offsetWidth - 4);
				sizes._vx = sizes.dx - sizes.px;
				if(smduiCustomScroll.trackBar)
					sizes._bar_x = smduiCustomScroll._create_bar(this,"x");
			}
			if (sizes._scroll_y){
				sizes._scroll_y_node = smduiCustomScroll._create_scroll(this, "y", sizes.dy, sizes.py, "height", "width");
				sizes._sy = (sizes.py - sizes._scroll_y_node.offsetHeight - 4);
				sizes._vy = sizes.dy - sizes.py;

				if(smduiCustomScroll.trackBar)
					sizes._bar_y = smduiCustomScroll._create_bar(this,"y");
			}

			smduiCustomScroll._update_scroll(this);
		},
		_create_bar: function(node, mode){
			var bar = smdui.html.create("DIV", {
				"smduiignore":"1",
				"class":"smdui_c_scroll_bar_"+mode
			},"");

			node.appendChild(bar);
			return bar;
		},
		_adjust_scroll:function(node, old, pos){
			var config = node._custom_scroll_size;
			var view = node._custom_scroll_view;
			if (view) view = smdui.$$(view);

			if (config._scroll_x_node == node._scroll_drag_enabled){
				var next = (pos.x - old.x)*config._vx/config._sx;
				if (view)
					view._x_scroll.scrollTo(view._scrollLeft+next);
				else
					smduiCustomScroll._set_scroll_value(node, "scrollLeft", next);
			}
			if (config._scroll_y_node == node._scroll_drag_enabled){
				var next = (pos.y - old.y)*config._vy/config._sy;
				if (view)
					view._y_scroll.scrollTo(view._scrollTop+next);
				else
					smduiCustomScroll._set_scroll_value(node, "scrollTop", next);
			}

			node._scroll_drag_pos = pos;
			smduiCustomScroll._update_scroll(node);
		},
		_get_datatable_sizes:function(view){
			var sizes = {};
			if (view._x_scroll && view._settings.scrollX){
				sizes.dx = view._x_scroll._settings.scrollWidth;
				sizes.px = view._x_scroll._last_set_size || 1;
				sizes._scroll_x = sizes.dx - sizes.px > 1;
			}
			if (view._y_scroll && view._settings.scrollY){
				sizes.dy = view._y_scroll._settings.scrollHeight;
				sizes.py = view._y_scroll._last_set_size || 1;
				sizes._scroll_y = sizes.dy - sizes.py > 1;
			}
			return sizes;
		},
		_mouse_out:function(){
			clearTimeout(this._mouse_out_timer);
			this._mouse_out_timer = smdui.delay(smduiCustomScroll._mouse_out_timed, this, [], 200);
		},
		_removeScroll:function(scroll){
			if (scroll){
				smdui.html.remove(scroll);
				if (scroll._smdui_event_sc1){
					smdui.eventRemove(scroll._smdui_event_sc1);
					smdui.eventRemove(scroll._smdui_event_sc2);
				}
			}
		},
		_mouse_out_timed:function(){
			if (this._custom_scroll_size){
				if (this._scroll_drag_enabled){
					this._scroll_drag_released = true;
					return;
				}
				var sizes = this._custom_scroll_size;
				smduiCustomScroll._removeScroll(sizes._scroll_x_node);
				smduiCustomScroll._removeScroll(sizes._scroll_y_node);
				smdui.html.removeCss(document.body,"smdui_noselect");
				if(sizes._bar_x){
					smdui.html.remove(sizes._bar_x);
				}
				if(sizes._bar_y){
					smdui.html.remove(sizes._bar_y);
				}
				this._custom_scroll_size = null;
			}
		},
		_mouse_wheel:function(e){
			var sizes = this._custom_scroll_size;
			var delta = e.wheelDelta/-40;
			var toblock = true;
			if (!delta && e.detail && smdui.isUndefined(e.wheelDelta))
				delta = e.detail;
			if (sizes){
				if (sizes._scroll_x_node && (e.wheelDeltaX || ( delta && !sizes._scroll_y_node ))){
					var x_dir  = (e.wheelDeltaX/-40)||delta;
					//see below
					toblock = smduiCustomScroll._set_scroll_value(this, "scrollLeft", x_dir*smduiCustomScroll.scrollStep);
				} else if (delta && sizes._scroll_y_node){
					
					//lesser flickering of scroll in IE
					//also prevent scrolling outside of borders because of scroll-html-elements
					toblock = smduiCustomScroll._set_scroll_value(this, "scrollTop", delta*smduiCustomScroll.scrollStep);
				}
			}

			
			smduiCustomScroll._update_scroll(this);
			if (toblock !== false)
				return smdui.html.preventEvent(e);
		},
		_set_scroll_value:function(node, pose, value){
			var sizes = node._custom_scroll_size;
			var max_scroll = (pose == "scrollLeft") ? (sizes.dx - sizes.px) : (sizes.dy - sizes.py);
			var now = node[pose];

			if (now+value > max_scroll)
				value = max_scroll - now;
			if (!value || (now+value < 0 && now === 0))
				return false;
			
			
			if (smdui.env.isIE){
				smduiCustomScroll._update_scroll(node, pose, value + now);
				node[pose] += value;
			} else
				node[pose] += value;

			return true;
		},
		_create_scroll:function(node, mode, dy, py, dim, pos){
			var scroll = smdui.html.create("DIV", {
				"smduiignore":"1",
				"class":"smdui_c_scroll_"+mode
			},"<div></div>");

			scroll.style[dim] = Math.max((py*py/dy-7),40)+"px";
			node.style.position = "relative";
			node.appendChild(scroll);
			node._smdui_event_sc1 = smdui.event(scroll, "mousedown", smduiCustomScroll._scroll_drag(node));
			node._smdui_event_sc2 = smdui.event(document.body, "mouseup", smdui.bind(smduiCustomScroll._scroll_drop, node));
			return scroll;
		},
		_scroll_drag:function(node){
			return function(e){
				smdui.html.addCss(document.body,"smdui_noselect",1);
				this.className += " smdui_scroll_active";
				smduiCustomScroll._active_drag_area = node;
				node._scroll_drag_enabled = this;
				node._scroll_drag_pos = smdui.html.pos(e);
			};
		},
		_scroll_drop:function(node){
			if (this._scroll_drag_enabled){
				smdui.html.removeCss(document.body,"smdui_noselect");
				this._scroll_drag_enabled.className = this._scroll_drag_enabled.className.toString().replace(" smdui_scroll_active","");
				this._scroll_drag_enabled = false;
				smduiCustomScroll._active_drag_area = 0;
				if (this._scroll_drag_released){
					smduiCustomScroll._mouse_out_timed.call(this);
					this._scroll_drag_released = false;
				}
			}
		},
		_update_scroll:function(node, pose, value){
			var sizes = node._custom_scroll_size;
			if (sizes && (sizes._scroll_x_node||sizes._scroll_y_node)){
				var view = node._custom_scroll_view;

				var left_scroll = pose == "scrollLeft" ? value : node.scrollLeft;
				var left = view?smdui.$$(view)._scrollLeft:left_scroll;
				var shift_left = view?0:left;

				var top_scroll = pose == "scrollTop" ? value : node.scrollTop;
				var top = view?(smdui.$$(view)._scrollTop):top_scroll;
				var shift_top = view?0:top;

				if (sizes._scroll_x_node){
					sizes._scroll_x_node.style.bottom = 1 - shift_top + "px";
					sizes._scroll_x_node.style.left = Math.round(sizes._sx*left/(sizes.dx-sizes.px)) + shift_left + 1 +"px";
					if(sizes._bar_x){
						sizes._bar_x.style.bottom = 1 - shift_top + "px";
						sizes._bar_x.style.left = shift_left + "px";
					}
				}
				if (sizes._scroll_y_node){
					sizes._scroll_y_node.style.right = 0 - shift_left + "px";
					sizes._scroll_y_node.style.top = Math.round(sizes._sy*top/(sizes.dy-sizes.py)) + shift_top + 1 + "px";
					if(sizes._bar_y){
						sizes._bar_y.style.right = 0 - shift_left + "px";
						sizes._bar_y.style.top = shift_top + "px";
					}

				}
					
			}
		},
		_setDataHandler: function(view){
			if(view.data && view.data.attachEvent)
				view.data.attachEvent("onStoreUpdated", function(){
					var node = smduiCustomScroll._last_active_node;
					if(node && view.$view.contains(node))
						smduiCustomScroll.resize();
				});
		}
	};

})();
smdui.protoUI({
	name:"portlet",
	defaults:{
		layoutType:"wide",
	},
	$init:function(config){
		this._viewobj.style.position = "relative";

		if (config.header && config.body)
			config.body = [ { template:config.header, type:"header" }, config.body ];

		this.$ready.push(this._init_drag_area);
		// refresh scroll state of datatables
		smdui.attachEvent("onAfterPortletMove", this._refreshChildScrolls);
	},
	_refreshChildScrolls: function(source){
		smdui.ui.each(source, function(view){
			if(view._restore_scroll_state)
				view._restore_scroll_state();
		});
	},
	_init_drag_area:function(){
		var childs = this.getChildViews();

		if (childs.length > 1)
			smdui.DragControl.addDrag(childs[0].$view, this);
		else {
			var drag = smdui.html.create("div", { "class":"portlet_drag" }, "<span class='smdui_icon fa-bars'></span>");
			this._viewobj.appendChild(drag);
			smdui.DragControl.addDrag(drag, this);
		}
	},
	body_setter:function(value){
		return this.rows_setter(smdui.isArray(value) ? value:[value]);
	},
	markDropArea:function(target, mode){
		if (!target)
			return smdui.html.remove(this._markerbox);

		target = smdui.$$(target);

		if (!this._markerbox)
			this._markerbox = smdui.html.create("div",null,"&nbsp;");

		target.$view.appendChild(this._markerbox);
		this._markerbox.className = "portlet_marker"+mode;
	},
	movePortlet:function(target, mode){
		var parent = target.getParentView();
		var source = this.getParentView();

		var tindex = parent.index(target);
		var sindex = source.index(this);

		if (!smdui.callEvent("onBeforePortletMove", [source, parent, this, target, mode])) return;

		smdui.ui.$freeze = true;

		var shift = (source != parent ? 1 : 0);
		var isv = parent._vertical_orientation;		
		if ((mode == "top" || mode == "bottom")){
			if (isv !== 1){
				parent = smdui.ui({ type:target._settings.layoutType, rows:[] }, parent, tindex+shift);
				smdui.ui(target, parent, 0);
				tindex = 0; shift = 1;
			}
			if (mode == "bottom") shift+=1;
		} else if ((mode == "left" || mode == "right")){
			if (isv !== 0){
				parent = smdui.ui({ type:target._settings.layoutType, cols:[] }, parent, tindex+shift);
				smdui.ui(target, parent, 0);
				tindex = 0; shift = 1;
			}
			if (mode == "right") shift+=1;
		}

		if (sindex < tindex) shift -= 1;
		smdui.ui(this, parent, tindex+shift );
		if (mode == "replace")
			smdui.ui(target, source, sindex);

		this._removeEmptySource(source);

		smdui.ui.$freeze = false;

		var tops = source.getTopParentView();
		target.resize();
		source.resize();

		smdui.callEvent("onAfterPortletMove", [source, parent, this, target, mode]);
	},
	_removeEmptySource:function(view){
		var childview;
		var maxcount = 0;

		while (view.getChildViews().length <= maxcount){
			childview = view;
			view = view.getParentView();

			maxcount = 1;
		}

		if (maxcount)
			view.removeView(childview);
	},
	$drag:function(object, e){
		smdui.html.addCss(this._viewobj, "portlet_in_drag");
		smdui.DragControl._drag_context = {source:object, from:object};
		return this._viewobj.innerHTML;
	},
	$dragDestroy:function(target, html, e){
		smdui.html.removeCss(this._viewobj, "portlet_in_drag");
		smdui.html.remove(html);
		if (this._portlet_drop_target){
			this.movePortlet(this._portlet_drop_target, this._portlet_drop_mode);
			this.markDropArea();
			this._portlet_drop_target = null;
		}
	},
	_getDragItemPos: function(){
		return smdui.html.offset(this.$view);
	},
	$dragPos: function(pos, e, html){
		html.style.left = "-10000px";
		var evObj = smdui.env.mouse.context(e);
		var node = document.elementFromPoint(evObj.x, evObj.y);

		var view = null;
		if (node)
			view = smdui.$$(node);

		this._portlet_drop_target = this._getPortletTarget(view);
		this._portlet_drop_mode = this._markPortletDrag(this._portlet_drop_target, e);

		pos.x = pos.x - this._content_width + 10;
		pos.y = pos.y - 20;

		smdui.DragControl._skip = true;
	},
	_markPortletDrag:function(view, ev){
		var drop = "";
		var mode = "";

		if (ev && view){
			var box = smdui.html.offset(view.$view);
			var pos = smdui.html.pos(ev);
			var erx = (pos.x-box.x) - box.width/2;
			var ery = (pos.y-box.y) - box.height/2;

			mode = view._settings.mode;
			if (!mode)
				mode = Math.abs(erx)*(box.height/box.width) > Math.abs(ery) ? "cols" : "rows";

			if (mode == "cols"){
				drop = erx >=0 ? "right" :"left";
			} else if (mode == "rows"){
				drop = ery >=0 ? "bottom" : "top";
			}

			this.markDropArea(view, drop);
		}

		this.markDropArea(view, drop);
		return drop || mode;
	},
	_getPortletTarget:function(view){
		while(view){
			if (view.movePortlet)
				return view;
			else
				view = view.getParentView();
		}
	}
}, smdui.ui.layout);

smdui.UIManager.getState = function(node, children) {
	children = (children||false);
	node = smdui.$$(node);
	var state = {
		id: node.config.id,
		width: node.config.width,
		height: node.config.height,
		gravity: node.config.gravity
	};
	if (!smdui.isUndefined(node.config.collapsed)) state.collapsed = node.config.collapsed;
	if (node.name === 'tabs' || node.name === 'tabbar') state.activeCell = node.getValue();
	
	if (children) {
		state = [state];
		if (node._cells) {
			for (var i = 0; i < node._cells.length; i++)
				state = state.concat(this.getState(node._cells[i], children));
		}
	}
	return state;
};

smdui.UIManager.setState = function(states) {
	if (!smdui.isArray(states)) states = [states];

	for (var i = 0; i < states.length; i++) {
		var state = states[i];
		var node = smdui.$$(state.id);
		if (!node) continue;

		if (!smdui.isUndefined(state.collapsed)) node.define('collapsed', state.collapsed);
		if (!smdui.isUndefined(state.activeCell)) node.setValue(state.activeCell);

		node.define('width', state.width);
		node.define('height', state.height);
		node.define('gravity', state.gravity);
	}
	var top = smdui.$$(states[0].id);
	if (top) top.resize();
};

smdui.protoUI({
	name: "richtext",
	defaults:{
		label:"",
		labelWidth:80,
		labelPosition:"left"
	},
	$init: function(config) {
		this.$ready.unshift(this._setLayout);
	},
	getInputNode:function(){
		return this.$view.querySelector(".smdui_richtext_editor"); 
	},
	_button:function(name){
		return {
			view: "toggle",
			type: "iconButton",
			icon: name, name: name, id:name,
			label: smdui.i18n.richtext[name],
			autowidth: true, 
			action:name,
			click: this._add_data
		};
	},
	_setLayout: function() {
		var top = this;

		var editField = {
			view: "template",
            css: "smdui_richtext_container",
            borderless: true,
			template: "<div class='smdui_richtext_editor' contenteditable='true'>"+this.getValue()+"</div>",
			on: {
				onAfterRender: function() {
					smdui._event(
						top.getInputNode(),
						"input",
						function(){
							this.config.value = this.getInputNode().innerHTML;
						},
						{ bind: top }
					);
					smdui._event( 
						top.getInputNode(),
						"keyup",
						function(){
						  top._getselection();
					});
				}
			},
			onClick: {
				smdui_richtext_editor: function() {
					top._getselection();
				}
			}
		};

		var editorToolbar = {
			view: "toolbar",
			id:"toolbar",
			elements: [
				this._button("underline"),
				this._button("bold"),
				this._button("italic"),
				{}
			]
		};

		var rows = [
			editorToolbar,
			editField
		];

		if (this.config.labelPosition === "top" || !this.config.labelWidth){
			editorToolbar.elements.push({
				view:"label", label: this.config.label, align:"right"
			});
			this.rows_setter(rows);
		} else {
			this.config.borderless = true;
			this.cols_setter([{ 
				template: (this.config.label || " "),
				width: this.config.labelWidth
			}, {
				rows:rows
			}]);
		}
	},
	_getselection: function() {
		var top = this.getTopParentView();
		var bar = top.$$("toolbar");
		var sel;

		bar.setValues({
			italic:false, underline:false, bold:false
		});

		if(window.getSelection) {
			sel = window.getSelection();
		} else {
			sel = document.selection.createRange();
		}

		for (var i = 0; i < sel.rangeCount; ++i) {
			var range = sel.getRangeAt(i);
			if (this.$view.contains(this.getInputNode())){
				if (document.queryCommandState("bold")) {
					top.$$("bold").setValue(true);
				} 
				if (document.queryCommandState("underline")) {
					top.$$("underline").setValue(true);
				}
				if (document.queryCommandState("italic")) {
					top.$$("italic").setValue(true);
				}
			}
		}
	},
	refresh: function() {
		this.getInputNode().innerHTML = this.config.value;
	},
	_execCommandOnElement:function(el, commandName) {
		var sel, selText;

		if(window.getSelection()) {
			sel = window.getSelection();
			selText = sel.toString().length;
		} else {
			sel = document.selection.createRange();
			selText = sel.text.length;
		}

		if(selText > 0) {
			for (var i = 0; i < sel.rangeCount; ++i) {
				var range = sel.getRangeAt(i);
				if (!sel.isCollapsed) {
					document.execCommand(commandName, false, '');
				} else {
					var textValue = sel.focusNode.textContent;
					var focusEl = sel.focusNode;
					var focustext = sel.anchorOffset;
					var wordBegining = textValue.substring(0, focustext).match(/[A-Za-z]*$/)[0];
					var wordEnd = textValue.substring(focustext).match(/^[A-Za-z]*/)[0];

					var startWord = focustext - wordBegining.length;
					var endWord = focustext + wordEnd.length;

					range.setStart(focusEl, startWord);
					range.setEnd(focusEl, endWord);
					sel.removeAllRanges();

					window.getSelection().addRange(range);
					document.execCommand(commandName, false, '');
				}   
			}
		}
	},
	_add_data:function() {
		var style = this.config.action;
		var top = this.getTopParentView();
		var editableElement = top.getInputNode();

		if(this.$view.contains(this.getInputNode())){
			top._execCommandOnElement(editableElement, this.config.action);
		}
	},
	focus: function() {
		var editableElement = this.$view.querySelector(".smdui_richtext_editor");
		editableElement.focus();
	},
	setValue: function(value) {
		var old = this.config.value;
		this.config.value = value || "";

		if (old !== value)
			this.callEvent("onChange", [value, old]);

		this.refresh();
	},
	getValue: function() {
		var value = this.config.value;
		return value || (value ===0?"0":"");
	}
}, smdui.IdSpace, smdui.ui.layout);

smdui.protoUI({
    name: "gage",
    defaults: {
        value: 0,
        minRange: 0,
        maxRange: 100,
        minWidth:250,
        minHeight:200,
        smoothFlow: true,
        scale:3,
        stroke:7
    },
    $init: function() {
        this.$ready.push(smdui.bind(this._setDefaultView, this));
        this.attachEvent("onDestruct", function(){
            this._circleGradient = this._gageGradientPoint = this._gage = null;
        });
    },
    $setSize: function(x, y) {
        if (smdui.ui.view.prototype.$setSize.call(this, x, y)){
            this._refresh(this.config.value);
            this._animate(this.config.value);
        }
    },
    _refresh: function() {
        var curves = this.$view.querySelector('.smdui_gage_curves'),
            gageInfo = this.$view.querySelector('.smdui_gage_info'),
            kx = this.config.scale,
            x = this.$width;

        curves.setAttribute("r", (x / kx));
        curves.setAttribute("strokeDasharray", Math.round(Math.PI * x / kx));
        curves.style.r = x / kx;
        curves.style.strokeDasharray = Math.round(Math.PI * x / kx);

        gageInfo.setAttribute('style', "width: "+Math.round((x / kx) * 2)+"px;");
        this._gage.setAttribute('style', "height: "+(x / kx + 20)+"px;");
        this._circleGradient.setAttribute("r", (x / kx));
        this._circleGradient.setAttribute('style', "stroke-dasharray: " + Math.round(this.gradientLength * Math.PI * x / kx) + ", 1900;");
        this._draw_line(curves.style.r);
    },
    _safeValue: function(value){
        return Math.min(Math.max(value, this._settings.minRange), this._settings.maxRange);
    },
    _draw_line: function(radius) {
        var svgCoord = this.$width,
            arrowSpace = 0.05,
            value = this.config.value;

        value = this._safeValue(value);

        var currentChartValue = value - this.config.minRange;
        var degrees = Math.round(currentChartValue * 180 / (this.config.maxRange - this.config.minRange));

        if(degrees === 0 || degrees === 180) {
            this._gage.style.paddingTop = "3px";
        }
        this._gageGradientPoint.style.transformOrigin = (svgCoord / 2 - (0.5 + arrowSpace)) + 'px 0 0';
        this._gageGradientPoint.setAttribute('y1', '0');
        this._gageGradientPoint.setAttribute('x1', Math.round(svgCoord * (0.5 + arrowSpace)));

        this._gageGradientPoint.setAttribute('y2', 0);
        this._gageGradientPoint.setAttribute('x2', Math.round(svgCoord * (0.5 + arrowSpace / 2) + parseInt(radius)));
    },
    _animate: function(value) {
        var smduiGageValue = this.$view.querySelector('.smdui_gage-value');
        var currentChartValue = this._safeValue(value) - this.config.minRange;
        var degrees = Math.round(currentChartValue * 180 / (this.config.maxRange - this.config.minRange));
        var viewSize = this.$width;
        
        viewSize = Math.floor(viewSize/10);
        this.$view.style.fontSize = viewSize+'px';
        smduiGageValue.innerHTML = value;
        
        this._circleGradient.style.stroke = this.color;
        this._circleGradient.setAttribute("stroke", this.color);
        this._gageGradientPoint.setAttribute("transform", "rotate(" + degrees + " "+ this.$width/2 +" 0)");
        this._gageGradientPoint.style.transform = "rotate(" + degrees + "deg)";
    },
    _setDash: function() {
        smdui.assert(this.config.minRange < this.config.maxRange, "Invalid Range Values");
        this.gradientLength = (this._safeValue(this.config.value) - this.config.minRange) / (this.config.maxRange - this.config.minRange);
        
        var template = this.config.color;
        if (template){
            if (typeof template === "function")
                this.color = template.call(this, this.config.value);
            else
                this.color = template;
        } else
            this.color = "hsl(" + (120 - Math.round(this.gradientLength * 120)) + ", 100%, 50%)";

        if (this.config.animation === true) {
            this.defaultColor = "hsl(125, 100%, 50%)";
        } else {
            this.defaultColor = "hsl(" + (120 - Math.round(this.gradientLength * 120)) + ", 100%, 50%)";
        }
    },
    _setDefaultView: function() {
        this.gradientLength = 0;
        this._setDash();
        this.$view.innerHTML = '<div class="smdui_gage_label"><span>'+(this.config.label||"")+'</span></div><svg class="smdui_gage" style="height:300px; position: relative;"><circle class="smdui_gage_curves" r="0" cx="50%" cy="0" stroke="#EEEEEE" stroke-width="'+this.config.stroke+'%" fill="none"></circle><circle class="smdui_gage_gradient" r="0" stroke="'+this.defaultColor+'" cx="50%" cy="0" stroke-width="'+this.config.stroke+'%" fill="none" style="stroke-dasharray: 0, 1900;"></circle><line class="smdui_gage_gradient_point" x1="0" x2="0" y1="0" y2="0" style="stroke:#B0B0B0; stroke-width:4;"></line></svg><div class="smdui_gage_info"><div class="smdui_gage_min_range">'+this.config.minRange+'</div><div class="smdui_gage_max_range">'+this.config.maxRange+'</div><div class="smdui_gage_placeholder"><div class="smdui_gage-value">'+this.config.value+'</div><div class="smdui_gage_range_info">'+(this.config.placeholder||"")+'</div></div></div>';
        this._circleGradient = this.$view.querySelector('.smdui_gage_gradient');
        this._gageGradientPoint = this.$view.querySelector('.smdui_gage_gradient_point');
        this._gage = this.$view.querySelector('.smdui_gage');
        if (this.isVisible() === true && this.config.smoothFlow === true && (smdui.env.svganimation && !smdui.env.isEdge)) {
            this._circleGradient.setAttribute('class', 'smdui_gage_gradient smdui_gage_animated');
            this._gageGradientPoint.setAttribute('class', 'smdui_gage_gradient_point smdui_gage_gradient_point_animated');
        }
    },
    setValue: function(value) {
        this.config.value = value;
        this._setDash();
        this._refresh();
        this._animate(value);
    },
    getValue: function() {
        return this.config.value;
    }
}, smdui.EventSystem, smdui.ui.view);

smdui.protoUI({
	name: "bullet",
	defaults: {
		color: "#394646",
		marker: false,
		layout: "x",
		barWidth: 40,
		flowTime: 500,
		labelWidth: 150,
		stroke: 8,
		bands:[
			{ value:100, color:"#5be5d6"},
			{ value:80, color:"#fff07e" },
			{ value:60, color:"#fd8b8c" } 
		],
		scale: { 
			step:10
		}
	},
	label_setter:smdui.template,
	placeholder_setter: smdui.template,
	$init:function(obj){
		if (obj) {
			if ((!obj.layout || obj.layout === "x") && !obj.height)
				obj.height = obj.scale === false ? 60: 90;
			if (obj.layout === "y" && !obj.width)
				obj.width = obj.scale === false ? 60: 97;
		}
	},
	scale_setter:function(config){
		config.step = config.step || 10;
		config.template = smdui.template(config.template||"#value#");
		return config;
	},
	$setSize: function(x, y) {
		if (smdui.ui.view.prototype.$setSize.call(this, x, y)) {
			this._setDefaultView(this._settings.layout === "y" ? y : x);
			if (this._settings.value)
				this._animate(0, this._settings.value);
		}
	},
	_safeValue: function(value) {
		return Math.min(Math.max(value, this._settings.minRange), this._settings.maxRange);
	},
	_animateFrame: function(timestamp) {
		this._dt = timestamp - (this._time || timestamp);
		this._time = timestamp;
		var fps;

		if(this._settings.flowTime > this._dt) {
			fps = this._settings.flowTime / this._dt;
		} else {
			fps = this._settings.flowTime;
		}

		if (fps > 1000 || fps < 5) fps = 30;

		var step = (this._settings.value - this._prevValue)/fps;
		this._nowValue += step;

		if (Math.abs(this._nowValue - this._settings.value) < Math.abs(step))
			this._nowValue = this._settings.value;

		if (this._nowValue != this._settings.value){
			this._requestId = requestAnimationFrame(this._animateFrame.bind(this));
		} else {
			cancelAnimationFrame(this._requestId);
			this._requestId = null;
		}
		this._bulletValue.setAttribute("width", Math.floor(this._nowValue * this._scale));
	},
	_animate: function(from, to){
		this._prevValue = this._nowValue = from;
		this._settings.value = to;

		var label = this._settings.label;
		if (label)
			this.$view.querySelector(".smdui_bullet_header").textContent = label(this._settings);

		var placeholder = this._settings.placeholder;
		if (typeof  placeholder === "function")
			this.$view.querySelector(".smdui_bullet_subheader").textContent = placeholder(this._settings);

		if (this.isVisible() === true && this._settings.smoothFlow === true && (window.requestAnimationFrame)) {
			if (!this._requestId)
				this._requestId = requestAnimationFrame(this._animateFrame.bind(this));
		} else {
			this._bulletValue.setAttribute("width", Math.floor(to * this._scale));
		}
	},
	_setAttr: function(tag, names, values) {
		for (var i = 0; i < names.length; i++)
			tag.setAttribute(names[i], values[i]);
	},
	_createNS:function(tag, names, values){
		var ns = "http://www.w3.org/2000/svg";
		var el = document.createElementNS(ns, tag);
		if (names)
			this._setAttr(el, names, values);

		return el;
	},
	_dom:function(data){
		var top = this._createNS(data[0], data[1], data[2]);
		var child = data[3];
		if (child)
			for (var i = 0; i < child.length; i++)
				top.appendChild(this._dom(child[i]));

		return top;
	},
	_setView: function() {
		var id = "d"+smdui.uid();
		var svg 		= this._createNS("svg", 	["class"], ["smdui_bullet_graph_svg"]);
		var container 	= this._createNS('g');
		var containerBand = this._createNS('g');
		var value 		= this._createNS('rect', 	["x","y", "width", "height", "class", "style"], [this._leftStart, this._topStart, 100, this._settings.stroke, "smdui_bullet_value","filter:url(#"+id+");fill:"+this._settings.color]);
		
		var valueMarker = this._createNS('rect', ["x","y", "width", "height", "fill"], [0, 5, 3, (this._settings.barWidth - 10), "rgba(0,0,0,0.5)"]);
		var division 	= this._createNS('g', 	["stroke", "stroke-width", "fill"], ["#8b94ac", "2", "none"]);
		var text 		= this._createNS('text', ["text-anchor", "stroke", "fill"], ["end", "none", "#8b94ac"]);
		var left = this._settings.layout == "y" ? "50%" : this._leftStart - 10;
		var top = this._settings.layout == "y" ? 11 : 17;
		var textRow1 	= this._createNS('tspan',["x", "y", "class"], [left, top, "smdui_bullet_header"]);
		var textRow2 	= this._createNS('tspan',["x", "y", "class"], [left, top+17, "smdui_bullet_subheader"]);
		var range 		= this._createNS('text', ["text-anchor", "stroke", "class", "fill"], ["middle", "none", "smdui_bullet_scale", "#8b94ac"]);

		var filter = this._dom(
			["filter", ["id","x","y", "width", "height"], [id, "0","-150%", "110%", "400%"], [
				["feOffset",["in", "dx","dy"],["SourceAlpha", 0, 0 ]],
				["feGaussianBlur",["stdDeviation"],["2"]],
				["feComponentTransfer", 0 ,0, [
					["feFuncA", ["type", "slope"], ["linear", "0.5"]]
				]],
				["feMerge", 0,0, [
					["feMergeNode"],
					["feMergeNode", ["in"], ["SourceGraphic"]]
				]]
			]]
		);

		svg.appendChild(filter);
 
		var tempContainer = document.createElement('div');
		container.appendChild(containerBand);

		if(this._settings.marker !== false) {
			valueMarker.setAttribute("x", (this._leftStart + this._safeValue(this._settings.marker)*this._scale - 2));
			container.appendChild(valueMarker);
		}

		container.appendChild(value);
		text.appendChild(textRow1);
		text.appendChild(textRow2);
		svg.appendChild(text);

		var vertical = this._settings.layout === "y";
		if (this._settings.scale){
			for (var i = this._settings.minRange; i <= this._settings.maxRange; i+= this._settings.scale.step){
				var label = this._settings.labelHeight || this._settings.labelWidth;
				var left = Math.floor(label + i*this._scale-(i?0.1:-1));
				var x = vertical ? (this.$width - this._settings.barWidth)/2 + -10 : left; 
				var y = vertical ? this._chartWidth - left + label + 44 : this._settings.barWidth + 28;
				var z = vertical ? -13 : this._settings.barWidth+3;
				var align = vertical ? "end" : "middle";

				var bulletRangeChild = this._createNS('tspan',
					["x", "y", "text-anchor"], [x, y, align]);
				var bulletDivChild = this._createNS('line', 
					["x1", "y1", "x2", "y2", "stroke-width"], [left,z,left,z+10,1]);

				tempContainer.innerHTML = this._settings.scale.template({ value: i });
				bulletRangeChild.appendChild(tempContainer.childNodes[0]);
				range.appendChild(bulletRangeChild);
				division.appendChild(bulletDivChild);
			
			}

			container.appendChild(division);
			svg.appendChild(range);
		}


		for (var i = 0; i < this._settings.bands.length; i++){
			var obj = this._settings.bands[i];
			var band = this._createNS('path');
			var value = this._safeValue(obj.value)*this._scale;
			band.setAttribute("d", "M "+this._leftStart+",0 l " + value + ",0 l 0,"+this._settings.barWidth+" l -" + value + ",0 z");
			band.setAttribute("fill", obj.color);
			containerBand.appendChild(band);
		}

		svg.appendChild(container);

		if (this._settings.layout === "y"){
			var w = this._settings.scale?(this.$width / 2 - 10):0;
			var h = this.$height + this._leftStart - 28;
			container.setAttribute("transform", "translate("+w+", "+h+") rotate(270)");
			text.setAttribute("text-anchor", "middle");
			text.childNodes[0].setAttribute("x", "55%");
			text.childNodes[1].setAttribute("x", "55%");
			range.setAttribute("text-anchor", "right");
		}
		svg.setAttribute("viewBox", "0 0 " + this.$width  + " " + this.$height  + "");

		return svg;
	},
	_setDefaultView: function(size) {
		if (!size) return;
		smdui.assert(this.config.minRange < this.config.maxRange, "Invalid Range Values");
		var _view = this.$view;
		_view.innerHTML = "";
		
		var label = this._settings.labelHeight || this._settings.labelWidth;

		this._leftStart = this._settings.label ? label : 7;
		this._topStart =  Math.floor((this._settings.barWidth - this._settings.stroke)/2);
		this._chartWidth = size - this._leftStart - 30;
		this._scale = this._chartWidth / (this._settings.maxRange - this._settings.minRange);

		var svg = this._setView();
		// scale height fix for ie
		svg.setAttribute("height", this.$height); 
		svg.setAttribute("width", this.$width);

		_view.appendChild(svg);
		this._bulletValue = _view.querySelector(".smdui_bullet_value");
	},
	setValue: function(value) {
		if (this._settings.value != value){
			this._animate(this._settings.value, value);
		}
	},
	getValue: function() {
		return this._settings.value;
	}
}, smdui.ui.gage, smdui.ui.view);
