(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (factory((global.VueCroppie = {})));
}(this, (function (exports) { 'use strict';

    /**
     * Make a map and return a function for checking if a key
     * is in that map.
     * IMPORTANT: all calls of this function must be prefixed with
     * \/\*#\_\_PURE\_\_\*\/
     * So that rollup can tree-shake them if necessary.
     */
    function makeMap(str, expectsLowerCase) {
        const map = Object.create(null);
        const list = str.split(',');
        for (let i = 0; i < list.length; i++) {
            map[list[i]] = true;
        }
        return expectsLowerCase ? val => !!map[val.toLowerCase()] : val => !!map[val];
    }

    const GLOBALS_WHITE_LISTED = 'Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,' +
        'decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,' +
        'Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt';
    const isGloballyWhitelisted = /*#__PURE__*/ makeMap(GLOBALS_WHITE_LISTED);

    /**
     * On the client we only need to offer special cases for boolean attributes that
     * have different names from their corresponding dom properties:
     * - itemscope -> N/A
     * - allowfullscreen -> allowFullscreen
     * - formnovalidate -> formNoValidate
     * - ismap -> isMap
     * - nomodule -> noModule
     * - novalidate -> noValidate
     * - readonly -> readOnly
     */
    const specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`;
    const isSpecialBooleanAttr = /*#__PURE__*/ makeMap(specialBooleanAttrs);
    /**
     * The full list is needed during SSR to produce the correct initial markup.
     */
    const isBooleanAttr = /*#__PURE__*/ makeMap(specialBooleanAttrs +
        `,async,autofocus,autoplay,controls,default,defer,disabled,hidden,` +
        `loop,open,required,reversed,scoped,seamless,` +
        `checked,muted,multiple,selected`);
    /**
     * CSS properties that accept plain numbers
     */
    const isNoUnitNumericStyleProp = /*#__PURE__*/ makeMap(`animation-iteration-count,border-image-outset,border-image-slice,` +
        `border-image-width,box-flex,box-flex-group,box-ordinal-group,column-count,` +
        `columns,flex,flex-grow,flex-positive,flex-shrink,flex-negative,flex-order,` +
        `grid-row,grid-row-end,grid-row-span,grid-row-start,grid-column,` +
        `grid-column-end,grid-column-span,grid-column-start,font-weight,line-clamp,` +
        `line-height,opacity,order,orphans,tab-size,widows,z-index,zoom,` +
        // SVG
        `fill-opacity,flood-opacity,stop-opacity,stroke-dasharray,stroke-dashoffset,` +
        `stroke-miterlimit,stroke-opacity,stroke-width`);
    /**
     * Known attributes, this is used for stringification of runtime static nodes
     * so that we don't stringify bindings that cannot be set from HTML.
     * Don't also forget to allow `data-*` and `aria-*`!
     * Generated from https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes
     */
    const isKnownAttr = /*#__PURE__*/ makeMap(`accept,accept-charset,accesskey,action,align,allow,alt,async,` +
        `autocapitalize,autocomplete,autofocus,autoplay,background,bgcolor,` +
        `border,buffered,capture,challenge,charset,checked,cite,class,code,` +
        `codebase,color,cols,colspan,content,contenteditable,contextmenu,controls,` +
        `coords,crossorigin,csp,data,datetime,decoding,default,defer,dir,dirname,` +
        `disabled,download,draggable,dropzone,enctype,enterkeyhint,for,form,` +
        `formaction,formenctype,formmethod,formnovalidate,formtarget,headers,` +
        `height,hidden,high,href,hreflang,http-equiv,icon,id,importance,integrity,` +
        `ismap,itemprop,keytype,kind,label,lang,language,loading,list,loop,low,` +
        `manifest,max,maxlength,minlength,media,min,multiple,muted,name,novalidate,` +
        `open,optimum,pattern,ping,placeholder,poster,preload,radiogroup,readonly,` +
        `referrerpolicy,rel,required,reversed,rows,rowspan,sandbox,scope,scoped,` +
        `selected,shape,size,sizes,slot,span,spellcheck,src,srcdoc,srclang,srcset,` +
        `start,step,style,summary,tabindex,target,title,translate,type,usemap,` +
        `value,width,wrap`);

    function normalizeStyle(value) {
        if (isArray(value)) {
            const res = {};
            for (let i = 0; i < value.length; i++) {
                const item = value[i];
                const normalized = normalizeStyle(isString(item) ? parseStringStyle(item) : item);
                if (normalized) {
                    for (const key in normalized) {
                        res[key] = normalized[key];
                    }
                }
            }
            return res;
        }
        else if (isObject(value)) {
            return value;
        }
    }
    const listDelimiterRE = /;(?![^(]*\))/g;
    const propertyDelimiterRE = /:(.+)/;
    function parseStringStyle(cssText) {
        const ret = {};
        cssText.split(listDelimiterRE).forEach(item => {
            if (item) {
                const tmp = item.split(propertyDelimiterRE);
                tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim());
            }
        });
        return ret;
    }
    function normalizeClass(value) {
        let res = '';
        if (isString(value)) {
            res = value;
        }
        else if (isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                const normalized = normalizeClass(value[i]);
                if (normalized) {
                    res += normalized + ' ';
                }
            }
        }
        else if (isObject(value)) {
            for (const name in value) {
                if (value[name]) {
                    res += name + ' ';
                }
            }
        }
        return res.trim();
    }

    // These tag configs are shared between compiler-dom and runtime-dom, so they
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Element
    const HTML_TAGS = 'html,body,base,head,link,meta,style,title,address,article,aside,footer,' +
        'header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,div,dd,dl,dt,figcaption,' +
        'figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,' +
        'data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,s,samp,small,span,strong,sub,sup,' +
        'time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,' +
        'canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,' +
        'th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,' +
        'option,output,progress,select,textarea,details,dialog,menu,' +
        'summary,template,blockquote,iframe,tfoot';
    // https://developer.mozilla.org/en-US/docs/Web/SVG/Element
    const SVG_TAGS = 'svg,animate,animateMotion,animateTransform,circle,clipPath,color-profile,' +
        'defs,desc,discard,ellipse,feBlend,feColorMatrix,feComponentTransfer,' +
        'feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,' +
        'feDistanceLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR,' +
        'feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset,' +
        'fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,' +
        'foreignObject,g,hatch,hatchpath,image,line,linearGradient,marker,mask,' +
        'mesh,meshgradient,meshpatch,meshrow,metadata,mpath,path,pattern,' +
        'polygon,polyline,radialGradient,rect,set,solidcolor,stop,switch,symbol,' +
        'text,textPath,title,tspan,unknown,use,view';
    const VOID_TAGS = 'area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr';
    const isHTMLTag = /*#__PURE__*/ makeMap(HTML_TAGS);
    const isSVGTag = /*#__PURE__*/ makeMap(SVG_TAGS);
    const isVoidTag = /*#__PURE__*/ makeMap(VOID_TAGS);
    const EMPTY_OBJ = Object.freeze({});
    const EMPTY_ARR = Object.freeze([]);
    const NOOP = () => { };
    const onRE = /^on[^a-z]/;
    const isOn = (key) => onRE.test(key);
    const isModelListener = (key) => key.startsWith('onUpdate:');
    const extend = Object.assign;
    const remove = (arr, el) => {
        const i = arr.indexOf(el);
        if (i > -1) {
            arr.splice(i, 1);
        }
    };
    const hasOwnProperty = Object.prototype.hasOwnProperty;
    const hasOwn = (val, key) => hasOwnProperty.call(val, key);
    const isArray = Array.isArray;
    const isMap = (val) => toTypeString(val) === '[object Map]';
    const isSet = (val) => toTypeString(val) === '[object Set]';
    const isFunction = (val) => typeof val === 'function';
    const isString = (val) => typeof val === 'string';
    const isSymbol = (val) => typeof val === 'symbol';
    const isObject = (val) => val !== null && typeof val === 'object';
    const isPromise = (val) => {
        return isObject(val) && isFunction(val.then) && isFunction(val.catch);
    };
    const objectToString = Object.prototype.toString;
    const toTypeString = (value) => objectToString.call(value);
    const toRawType = (value) => {
        // extract "RawType" from strings like "[object RawType]"
        return toTypeString(value).slice(8, -1);
    };
    const isPlainObject = (val) => toTypeString(val) === '[object Object]';
    const isIntegerKey = (key) => isString(key) &&
        key !== 'NaN' &&
        key[0] !== '-' &&
        '' + parseInt(key, 10) === key;
    const isReservedProp = /*#__PURE__*/ makeMap(
    // the leading comma is intentional so empty string "" is also included
    ',key,ref,' +
        'onVnodeBeforeMount,onVnodeMounted,' +
        'onVnodeBeforeUpdate,onVnodeUpdated,' +
        'onVnodeBeforeUnmount,onVnodeUnmounted');
    const cacheStringFunction = (fn) => {
        const cache = Object.create(null);
        return ((str) => {
            const hit = cache[str];
            return hit || (cache[str] = fn(str));
        });
    };
    const camelizeRE = /-(\w)/g;
    /**
     * @private
     */
    const camelize = cacheStringFunction((str) => {
        return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''));
    });
    const hyphenateRE = /\B([A-Z])/g;
    /**
     * @private
     */
    const hyphenate = cacheStringFunction((str) => str.replace(hyphenateRE, '-$1').toLowerCase());
    /**
     * @private
     */
    const capitalize = cacheStringFunction((str) => str.charAt(0).toUpperCase() + str.slice(1));
    /**
     * @private
     */
    const toHandlerKey = cacheStringFunction((str) => (str ? `on${capitalize(str)}` : ``));
    // compare whether a value has changed, accounting for NaN.
    const hasChanged = (value, oldValue) => value !== oldValue && (value === value || oldValue === oldValue);
    const toNumber = (val) => {
        const n = parseFloat(val);
        return isNaN(n) ? val : n;
    };

    const targetMap = new WeakMap();
    const effectStack = [];
    let activeEffect;
    const ITERATE_KEY = Symbol('iterate');
    const MAP_KEY_ITERATE_KEY = Symbol('Map key iterate');
    function isEffect(fn) {
        return fn && fn._isEffect === true;
    }
    function effect(fn, options = EMPTY_OBJ) {
        if (isEffect(fn)) {
            fn = fn.raw;
        }
        const effect = createReactiveEffect(fn, options);
        if (!options.lazy) {
            effect();
        }
        return effect;
    }
    function stop(effect) {
        if (effect.active) {
            cleanup(effect);
            if (effect.options.onStop) {
                effect.options.onStop();
            }
            effect.active = false;
        }
    }
    let uid = 0;
    function createReactiveEffect(fn, options) {
        const effect = function reactiveEffect() {
            if (!effect.active) {
                return fn();
            }
            if (!effectStack.includes(effect)) {
                cleanup(effect);
                try {
                    enableTracking();
                    effectStack.push(effect);
                    activeEffect = effect;
                    return fn();
                }
                finally {
                    effectStack.pop();
                    resetTracking();
                    activeEffect = effectStack[effectStack.length - 1];
                }
            }
        };
        effect.id = uid++;
        effect.allowRecurse = !!options.allowRecurse;
        effect._isEffect = true;
        effect.active = true;
        effect.raw = fn;
        effect.deps = [];
        effect.options = options;
        return effect;
    }
    function cleanup(effect) {
        const { deps } = effect;
        if (deps.length) {
            for (let i = 0; i < deps.length; i++) {
                deps[i].delete(effect);
            }
            deps.length = 0;
        }
    }
    let shouldTrack = true;
    const trackStack = [];
    function pauseTracking() {
        trackStack.push(shouldTrack);
        shouldTrack = false;
    }
    function enableTracking() {
        trackStack.push(shouldTrack);
        shouldTrack = true;
    }
    function resetTracking() {
        const last = trackStack.pop();
        shouldTrack = last === undefined ? true : last;
    }
    function track(target, type, key) {
        if (!shouldTrack || activeEffect === undefined) {
            return;
        }
        let depsMap = targetMap.get(target);
        if (!depsMap) {
            targetMap.set(target, (depsMap = new Map()));
        }
        let dep = depsMap.get(key);
        if (!dep) {
            depsMap.set(key, (dep = new Set()));
        }
        if (!dep.has(activeEffect)) {
            dep.add(activeEffect);
            activeEffect.deps.push(dep);
            if (activeEffect.options.onTrack) {
                activeEffect.options.onTrack({
                    effect: activeEffect,
                    target,
                    type,
                    key
                });
            }
        }
    }
    function trigger(target, type, key, newValue, oldValue, oldTarget) {
        const depsMap = targetMap.get(target);
        if (!depsMap) {
            // never been tracked
            return;
        }
        const effects = new Set();
        const add = (effectsToAdd) => {
            if (effectsToAdd) {
                effectsToAdd.forEach(effect => {
                    if (effect !== activeEffect || effect.allowRecurse) {
                        effects.add(effect);
                    }
                });
            }
        };
        if (type === "clear" /* CLEAR */) {
            // collection being cleared
            // trigger all effects for target
            depsMap.forEach(add);
        }
        else if (key === 'length' && isArray(target)) {
            depsMap.forEach((dep, key) => {
                if (key === 'length' || key >= newValue) {
                    add(dep);
                }
            });
        }
        else {
            // schedule runs for SET | ADD | DELETE
            if (key !== void 0) {
                add(depsMap.get(key));
            }
            // also run for iteration key on ADD | DELETE | Map.SET
            switch (type) {
                case "add" /* ADD */:
                    if (!isArray(target)) {
                        add(depsMap.get(ITERATE_KEY));
                        if (isMap(target)) {
                            add(depsMap.get(MAP_KEY_ITERATE_KEY));
                        }
                    }
                    else if (isIntegerKey(key)) {
                        // new index added to array -> length changes
                        add(depsMap.get('length'));
                    }
                    break;
                case "delete" /* DELETE */:
                    if (!isArray(target)) {
                        add(depsMap.get(ITERATE_KEY));
                        if (isMap(target)) {
                            add(depsMap.get(MAP_KEY_ITERATE_KEY));
                        }
                    }
                    break;
                case "set" /* SET */:
                    if (isMap(target)) {
                        add(depsMap.get(ITERATE_KEY));
                    }
                    break;
            }
        }
        const run = (effect) => {
            if (effect.options.onTrigger) {
                effect.options.onTrigger({
                    effect,
                    target,
                    key,
                    type,
                    newValue,
                    oldValue,
                    oldTarget
                });
            }
            if (effect.options.scheduler) {
                effect.options.scheduler(effect);
            }
            else {
                effect();
            }
        };
        effects.forEach(run);
    }

    const isNonTrackableKeys = /*#__PURE__*/ makeMap(`__proto__,__v_isRef,__isVue`);
    const builtInSymbols = new Set(Object.getOwnPropertyNames(Symbol)
        .map(key => Symbol[key])
        .filter(isSymbol));
    const get = /*#__PURE__*/ createGetter();
    const shallowGet = /*#__PURE__*/ createGetter(false, true);
    const readonlyGet = /*#__PURE__*/ createGetter(true);
    const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true);
    const arrayInstrumentations = {};
    ['includes', 'indexOf', 'lastIndexOf'].forEach(key => {
        const method = Array.prototype[key];
        arrayInstrumentations[key] = function (...args) {
            const arr = toRaw(this);
            for (let i = 0, l = this.length; i < l; i++) {
                track(arr, "get" /* GET */, i + '');
            }
            // we run the method using the original args first (which may be reactive)
            const res = method.apply(arr, args);
            if (res === -1 || res === false) {
                // if that didn't work, run it again using raw values.
                return method.apply(arr, args.map(toRaw));
            }
            else {
                return res;
            }
        };
    });
    ['push', 'pop', 'shift', 'unshift', 'splice'].forEach(key => {
        const method = Array.prototype[key];
        arrayInstrumentations[key] = function (...args) {
            pauseTracking();
            const res = method.apply(this, args);
            resetTracking();
            return res;
        };
    });
    function createGetter(isReadonly = false, shallow = false) {
        return function get(target, key, receiver) {
            if (key === "__v_isReactive" /* IS_REACTIVE */) {
                return !isReadonly;
            }
            else if (key === "__v_isReadonly" /* IS_READONLY */) {
                return isReadonly;
            }
            else if (key === "__v_raw" /* RAW */ &&
                receiver ===
                    (isReadonly
                        ? shallow
                            ? shallowReadonlyMap
                            : readonlyMap
                        : shallow
                            ? shallowReactiveMap
                            : reactiveMap).get(target)) {
                return target;
            }
            const targetIsArray = isArray(target);
            if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
                return Reflect.get(arrayInstrumentations, key, receiver);
            }
            const res = Reflect.get(target, key, receiver);
            if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
                return res;
            }
            if (!isReadonly) {
                track(target, "get" /* GET */, key);
            }
            if (shallow) {
                return res;
            }
            if (isRef(res)) {
                // ref unwrapping - does not apply for Array + integer key.
                const shouldUnwrap = !targetIsArray || !isIntegerKey(key);
                return shouldUnwrap ? res.value : res;
            }
            if (isObject(res)) {
                // Convert returned value into a proxy as well. we do the isObject check
                // here to avoid invalid value warning. Also need to lazy access readonly
                // and reactive here to avoid circular dependency.
                return isReadonly ? readonly(res) : reactive(res);
            }
            return res;
        };
    }
    const set = /*#__PURE__*/ createSetter();
    const shallowSet = /*#__PURE__*/ createSetter(true);
    function createSetter(shallow = false) {
        return function set(target, key, value, receiver) {
            let oldValue = target[key];
            if (!shallow) {
                value = toRaw(value);
                oldValue = toRaw(oldValue);
                if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
                    oldValue.value = value;
                    return true;
                }
            }
            const hadKey = isArray(target) && isIntegerKey(key)
                ? Number(key) < target.length
                : hasOwn(target, key);
            const result = Reflect.set(target, key, value, receiver);
            // don't trigger if target is something up in the prototype chain of original
            if (target === toRaw(receiver)) {
                if (!hadKey) {
                    trigger(target, "add" /* ADD */, key, value);
                }
                else if (hasChanged(value, oldValue)) {
                    trigger(target, "set" /* SET */, key, value, oldValue);
                }
            }
            return result;
        };
    }
    function deleteProperty(target, key) {
        const hadKey = hasOwn(target, key);
        const oldValue = target[key];
        const result = Reflect.deleteProperty(target, key);
        if (result && hadKey) {
            trigger(target, "delete" /* DELETE */, key, undefined, oldValue);
        }
        return result;
    }
    function has(target, key) {
        const result = Reflect.has(target, key);
        if (!isSymbol(key) || !builtInSymbols.has(key)) {
            track(target, "has" /* HAS */, key);
        }
        return result;
    }
    function ownKeys(target) {
        track(target, "iterate" /* ITERATE */, isArray(target) ? 'length' : ITERATE_KEY);
        return Reflect.ownKeys(target);
    }
    const mutableHandlers = {
        get,
        set,
        deleteProperty,
        has,
        ownKeys
    };
    const readonlyHandlers = {
        get: readonlyGet,
        set(target, key) {
            {
                console.warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target);
            }
            return true;
        },
        deleteProperty(target, key) {
            {
                console.warn(`Delete operation on key "${String(key)}" failed: target is readonly.`, target);
            }
            return true;
        }
    };
    const shallowReactiveHandlers = extend({}, mutableHandlers, {
        get: shallowGet,
        set: shallowSet
    });
    // Props handlers are special in the sense that it should not unwrap top-level
    // refs (in order to allow refs to be explicitly passed down), but should
    // retain the reactivity of the normal readonly object.
    const shallowReadonlyHandlers = extend({}, readonlyHandlers, {
        get: shallowReadonlyGet
    });

    const toReactive = (value) => isObject(value) ? reactive(value) : value;
    const toReadonly = (value) => isObject(value) ? readonly(value) : value;
    const toShallow = (value) => value;
    const getProto = (v) => Reflect.getPrototypeOf(v);
    function get$1(target, key, isReadonly = false, isShallow = false) {
        // #1772: readonly(reactive(Map)) should return readonly + reactive version
        // of the value
        target = target["__v_raw" /* RAW */];
        const rawTarget = toRaw(target);
        const rawKey = toRaw(key);
        if (key !== rawKey) {
            !isReadonly && track(rawTarget, "get" /* GET */, key);
        }
        !isReadonly && track(rawTarget, "get" /* GET */, rawKey);
        const { has } = getProto(rawTarget);
        const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
        if (has.call(rawTarget, key)) {
            return wrap(target.get(key));
        }
        else if (has.call(rawTarget, rawKey)) {
            return wrap(target.get(rawKey));
        }
        else if (target !== rawTarget) {
            // #3602 readonly(reactive(Map))
            // ensure that the nested reactive `Map` can do tracking for itself
            target.get(key);
        }
    }
    function has$1(key, isReadonly = false) {
        const target = this["__v_raw" /* RAW */];
        const rawTarget = toRaw(target);
        const rawKey = toRaw(key);
        if (key !== rawKey) {
            !isReadonly && track(rawTarget, "has" /* HAS */, key);
        }
        !isReadonly && track(rawTarget, "has" /* HAS */, rawKey);
        return key === rawKey
            ? target.has(key)
            : target.has(key) || target.has(rawKey);
    }
    function size(target, isReadonly = false) {
        target = target["__v_raw" /* RAW */];
        !isReadonly && track(toRaw(target), "iterate" /* ITERATE */, ITERATE_KEY);
        return Reflect.get(target, 'size', target);
    }
    function add(value) {
        value = toRaw(value);
        const target = toRaw(this);
        const proto = getProto(target);
        const hadKey = proto.has.call(target, value);
        if (!hadKey) {
            target.add(value);
            trigger(target, "add" /* ADD */, value, value);
        }
        return this;
    }
    function set$1(key, value) {
        value = toRaw(value);
        const target = toRaw(this);
        const { has, get } = getProto(target);
        let hadKey = has.call(target, key);
        if (!hadKey) {
            key = toRaw(key);
            hadKey = has.call(target, key);
        }
        else {
            checkIdentityKeys(target, has, key);
        }
        const oldValue = get.call(target, key);
        target.set(key, value);
        if (!hadKey) {
            trigger(target, "add" /* ADD */, key, value);
        }
        else if (hasChanged(value, oldValue)) {
            trigger(target, "set" /* SET */, key, value, oldValue);
        }
        return this;
    }
    function deleteEntry(key) {
        const target = toRaw(this);
        const { has, get } = getProto(target);
        let hadKey = has.call(target, key);
        if (!hadKey) {
            key = toRaw(key);
            hadKey = has.call(target, key);
        }
        else {
            checkIdentityKeys(target, has, key);
        }
        const oldValue = get ? get.call(target, key) : undefined;
        // forward the operation before queueing reactions
        const result = target.delete(key);
        if (hadKey) {
            trigger(target, "delete" /* DELETE */, key, undefined, oldValue);
        }
        return result;
    }
    function clear() {
        const target = toRaw(this);
        const hadItems = target.size !== 0;
        const oldTarget = isMap(target)
                ? new Map(target)
                : new Set(target);
        // forward the operation before queueing reactions
        const result = target.clear();
        if (hadItems) {
            trigger(target, "clear" /* CLEAR */, undefined, undefined, oldTarget);
        }
        return result;
    }
    function createForEach(isReadonly, isShallow) {
        return function forEach(callback, thisArg) {
            const observed = this;
            const target = observed["__v_raw" /* RAW */];
            const rawTarget = toRaw(target);
            const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
            !isReadonly && track(rawTarget, "iterate" /* ITERATE */, ITERATE_KEY);
            return target.forEach((value, key) => {
                // important: make sure the callback is
                // 1. invoked with the reactive map as `this` and 3rd arg
                // 2. the value received should be a corresponding reactive/readonly.
                return callback.call(thisArg, wrap(value), wrap(key), observed);
            });
        };
    }
    function createIterableMethod(method, isReadonly, isShallow) {
        return function (...args) {
            const target = this["__v_raw" /* RAW */];
            const rawTarget = toRaw(target);
            const targetIsMap = isMap(rawTarget);
            const isPair = method === 'entries' || (method === Symbol.iterator && targetIsMap);
            const isKeyOnly = method === 'keys' && targetIsMap;
            const innerIterator = target[method](...args);
            const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
            !isReadonly &&
                track(rawTarget, "iterate" /* ITERATE */, isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY);
            // return a wrapped iterator which returns observed versions of the
            // values emitted from the real iterator
            return {
                // iterator protocol
                next() {
                    const { value, done } = innerIterator.next();
                    return done
                        ? { value, done }
                        : {
                            value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
                            done
                        };
                },
                // iterable protocol
                [Symbol.iterator]() {
                    return this;
                }
            };
        };
    }
    function createReadonlyMethod(type) {
        return function (...args) {
            {
                const key = args[0] ? `on key "${args[0]}" ` : ``;
                console.warn(`${capitalize(type)} operation ${key}failed: target is readonly.`, toRaw(this));
            }
            return type === "delete" /* DELETE */ ? false : this;
        };
    }
    const mutableInstrumentations = {
        get(key) {
            return get$1(this, key);
        },
        get size() {
            return size(this);
        },
        has: has$1,
        add,
        set: set$1,
        delete: deleteEntry,
        clear,
        forEach: createForEach(false, false)
    };
    const shallowInstrumentations = {
        get(key) {
            return get$1(this, key, false, true);
        },
        get size() {
            return size(this);
        },
        has: has$1,
        add,
        set: set$1,
        delete: deleteEntry,
        clear,
        forEach: createForEach(false, true)
    };
    const readonlyInstrumentations = {
        get(key) {
            return get$1(this, key, true);
        },
        get size() {
            return size(this, true);
        },
        has(key) {
            return has$1.call(this, key, true);
        },
        add: createReadonlyMethod("add" /* ADD */),
        set: createReadonlyMethod("set" /* SET */),
        delete: createReadonlyMethod("delete" /* DELETE */),
        clear: createReadonlyMethod("clear" /* CLEAR */),
        forEach: createForEach(true, false)
    };
    const shallowReadonlyInstrumentations = {
        get(key) {
            return get$1(this, key, true, true);
        },
        get size() {
            return size(this, true);
        },
        has(key) {
            return has$1.call(this, key, true);
        },
        add: createReadonlyMethod("add" /* ADD */),
        set: createReadonlyMethod("set" /* SET */),
        delete: createReadonlyMethod("delete" /* DELETE */),
        clear: createReadonlyMethod("clear" /* CLEAR */),
        forEach: createForEach(true, true)
    };
    const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator];
    iteratorMethods.forEach(method => {
        mutableInstrumentations[method] = createIterableMethod(method, false, false);
        readonlyInstrumentations[method] = createIterableMethod(method, true, false);
        shallowInstrumentations[method] = createIterableMethod(method, false, true);
        shallowReadonlyInstrumentations[method] = createIterableMethod(method, true, true);
    });
    function createInstrumentationGetter(isReadonly, shallow) {
        const instrumentations = shallow
            ? isReadonly
                ? shallowReadonlyInstrumentations
                : shallowInstrumentations
            : isReadonly
                ? readonlyInstrumentations
                : mutableInstrumentations;
        return (target, key, receiver) => {
            if (key === "__v_isReactive" /* IS_REACTIVE */) {
                return !isReadonly;
            }
            else if (key === "__v_isReadonly" /* IS_READONLY */) {
                return isReadonly;
            }
            else if (key === "__v_raw" /* RAW */) {
                return target;
            }
            return Reflect.get(hasOwn(instrumentations, key) && key in target
                ? instrumentations
                : target, key, receiver);
        };
    }
    const mutableCollectionHandlers = {
        get: createInstrumentationGetter(false, false)
    };
    const readonlyCollectionHandlers = {
        get: createInstrumentationGetter(true, false)
    };
    const shallowReadonlyCollectionHandlers = {
        get: createInstrumentationGetter(true, true)
    };
    function checkIdentityKeys(target, has, key) {
        const rawKey = toRaw(key);
        if (rawKey !== key && has.call(target, rawKey)) {
            const type = toRawType(target);
            console.warn(`Reactive ${type} contains both the raw and reactive ` +
                `versions of the same object${type === `Map` ? ` as keys` : ``}, ` +
                `which can lead to inconsistencies. ` +
                `Avoid differentiating between the raw and reactive versions ` +
                `of an object and only use the reactive version if possible.`);
        }
    }

    const reactiveMap = new WeakMap();
    const shallowReactiveMap = new WeakMap();
    const readonlyMap = new WeakMap();
    const shallowReadonlyMap = new WeakMap();
    function targetTypeMap(rawType) {
        switch (rawType) {
            case 'Object':
            case 'Array':
                return 1 /* COMMON */;
            case 'Map':
            case 'Set':
            case 'WeakMap':
            case 'WeakSet':
                return 2 /* COLLECTION */;
            default:
                return 0 /* INVALID */;
        }
    }
    function getTargetType(value) {
        return value["__v_skip" /* SKIP */] || !Object.isExtensible(value)
            ? 0 /* INVALID */
            : targetTypeMap(toRawType(value));
    }
    function reactive(target) {
        // if trying to observe a readonly proxy, return the readonly version.
        if (target && target["__v_isReadonly" /* IS_READONLY */]) {
            return target;
        }
        return createReactiveObject(target, false, mutableHandlers, mutableCollectionHandlers, reactiveMap);
    }
    /**
     * Creates a readonly copy of the original object. Note the returned copy is not
     * made reactive, but `readonly` can be called on an already reactive object.
     */
    function readonly(target) {
        return createReactiveObject(target, true, readonlyHandlers, readonlyCollectionHandlers, readonlyMap);
    }
    /**
     * Returns a reactive-copy of the original object, where only the root level
     * properties are readonly, and does NOT unwrap refs nor recursively convert
     * returned properties.
     * This is used for creating the props proxy object for stateful components.
     */
    function shallowReadonly(target) {
        return createReactiveObject(target, true, shallowReadonlyHandlers, shallowReadonlyCollectionHandlers, shallowReadonlyMap);
    }
    function createReactiveObject(target, isReadonly, baseHandlers, collectionHandlers, proxyMap) {
        if (!isObject(target)) {
            {
                console.warn(`value cannot be made reactive: ${String(target)}`);
            }
            return target;
        }
        // target is already a Proxy, return it.
        // exception: calling readonly() on a reactive object
        if (target["__v_raw" /* RAW */] &&
            !(isReadonly && target["__v_isReactive" /* IS_REACTIVE */])) {
            return target;
        }
        // target already has corresponding Proxy
        const existingProxy = proxyMap.get(target);
        if (existingProxy) {
            return existingProxy;
        }
        // only a whitelist of value types can be observed.
        const targetType = getTargetType(target);
        if (targetType === 0 /* INVALID */) {
            return target;
        }
        const proxy = new Proxy(target, targetType === 2 /* COLLECTION */ ? collectionHandlers : baseHandlers);
        proxyMap.set(target, proxy);
        return proxy;
    }
    function isReactive(value) {
        if (isReadonly(value)) {
            return isReactive(value["__v_raw" /* RAW */]);
        }
        return !!(value && value["__v_isReactive" /* IS_REACTIVE */]);
    }
    function isReadonly(value) {
        return !!(value && value["__v_isReadonly" /* IS_READONLY */]);
    }
    function isProxy(value) {
        return isReactive(value) || isReadonly(value);
    }
    function toRaw(observed) {
        return ((observed && toRaw(observed["__v_raw" /* RAW */])) || observed);
    }
    function isRef(r) {
        return Boolean(r && r.__v_isRef === true);
    }

    const stack = [];
    function pushWarningContext(vnode) {
        stack.push(vnode);
    }
    function popWarningContext() {
        stack.pop();
    }
    function warn(msg, ...args) {
        // avoid props formatting or warn handler tracking deps that might be mutated
        // during patch, leading to infinite recursion.
        pauseTracking();
        const instance = stack.length ? stack[stack.length - 1].component : null;
        const appWarnHandler = instance && instance.appContext.config.warnHandler;
        const trace = getComponentTrace();
        if (appWarnHandler) {
            callWithErrorHandling(appWarnHandler, instance, 11 /* APP_WARN_HANDLER */, [
                msg + args.join(''),
                instance && instance.proxy,
                trace
                    .map(({ vnode }) => `at <${formatComponentName(instance, vnode.type)}>`)
                    .join('\n'),
                trace
            ]);
        }
        else {
            const warnArgs = [`[Vue warn]: ${msg}`, ...args];
            /* istanbul ignore if */
            if (trace.length &&
                // avoid spamming console during tests
                !false) {
                warnArgs.push(`\n`, ...formatTrace(trace));
            }
            console.warn(...warnArgs);
        }
        resetTracking();
    }
    function getComponentTrace() {
        let currentVNode = stack[stack.length - 1];
        if (!currentVNode) {
            return [];
        }
        // we can't just use the stack because it will be incomplete during updates
        // that did not start from the root. Re-construct the parent chain using
        // instance parent pointers.
        const normalizedStack = [];
        while (currentVNode) {
            const last = normalizedStack[0];
            if (last && last.vnode === currentVNode) {
                last.recurseCount++;
            }
            else {
                normalizedStack.push({
                    vnode: currentVNode,
                    recurseCount: 0
                });
            }
            const parentInstance = currentVNode.component && currentVNode.component.parent;
            currentVNode = parentInstance && parentInstance.vnode;
        }
        return normalizedStack;
    }
    /* istanbul ignore next */
    function formatTrace(trace) {
        const logs = [];
        trace.forEach((entry, i) => {
            logs.push(...(i === 0 ? [] : [`\n`]), ...formatTraceEntry(entry));
        });
        return logs;
    }
    function formatTraceEntry({ vnode, recurseCount }) {
        const postfix = recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``;
        const isRoot = vnode.component ? vnode.component.parent == null : false;
        const open = ` at <${formatComponentName(vnode.component, vnode.type, isRoot)}`;
        const close = `>` + postfix;
        return vnode.props
            ? [open, ...formatProps(vnode.props), close]
            : [open + close];
    }
    /* istanbul ignore next */
    function formatProps(props) {
        const res = [];
        const keys = Object.keys(props);
        keys.slice(0, 3).forEach(key => {
            res.push(...formatProp(key, props[key]));
        });
        if (keys.length > 3) {
            res.push(` ...`);
        }
        return res;
    }
    /* istanbul ignore next */
    function formatProp(key, value, raw) {
        if (isString(value)) {
            value = JSON.stringify(value);
            return raw ? value : [`${key}=${value}`];
        }
        else if (typeof value === 'number' ||
            typeof value === 'boolean' ||
            value == null) {
            return raw ? value : [`${key}=${value}`];
        }
        else if (isRef(value)) {
            value = formatProp(key, toRaw(value.value), true);
            return raw ? value : [`${key}=Ref<`, value, `>`];
        }
        else if (isFunction(value)) {
            return [`${key}=fn${value.name ? `<${value.name}>` : ``}`];
        }
        else {
            value = toRaw(value);
            return raw ? value : [`${key}=`, value];
        }
    }

    const ErrorTypeStrings = {
        ["bc" /* BEFORE_CREATE */]: 'beforeCreate hook',
        ["c" /* CREATED */]: 'created hook',
        ["bm" /* BEFORE_MOUNT */]: 'beforeMount hook',
        ["m" /* MOUNTED */]: 'mounted hook',
        ["bu" /* BEFORE_UPDATE */]: 'beforeUpdate hook',
        ["u" /* UPDATED */]: 'updated',
        ["bum" /* BEFORE_UNMOUNT */]: 'beforeUnmount hook',
        ["um" /* UNMOUNTED */]: 'unmounted hook',
        ["a" /* ACTIVATED */]: 'activated hook',
        ["da" /* DEACTIVATED */]: 'deactivated hook',
        ["ec" /* ERROR_CAPTURED */]: 'errorCaptured hook',
        ["rtc" /* RENDER_TRACKED */]: 'renderTracked hook',
        ["rtg" /* RENDER_TRIGGERED */]: 'renderTriggered hook',
        [0 /* SETUP_FUNCTION */]: 'setup function',
        [1 /* RENDER_FUNCTION */]: 'render function',
        [2 /* WATCH_GETTER */]: 'watcher getter',
        [3 /* WATCH_CALLBACK */]: 'watcher callback',
        [4 /* WATCH_CLEANUP */]: 'watcher cleanup function',
        [5 /* NATIVE_EVENT_HANDLER */]: 'native event handler',
        [6 /* COMPONENT_EVENT_HANDLER */]: 'component event handler',
        [7 /* VNODE_HOOK */]: 'vnode hook',
        [8 /* DIRECTIVE_HOOK */]: 'directive hook',
        [9 /* TRANSITION_HOOK */]: 'transition hook',
        [10 /* APP_ERROR_HANDLER */]: 'app errorHandler',
        [11 /* APP_WARN_HANDLER */]: 'app warnHandler',
        [12 /* FUNCTION_REF */]: 'ref function',
        [13 /* ASYNC_COMPONENT_LOADER */]: 'async component loader',
        [14 /* SCHEDULER */]: 'scheduler flush. This is likely a Vue internals bug. ' +
            'Please open an issue at https://new-issue.vuejs.org/?repo=vuejs/vue-next'
    };
    function callWithErrorHandling(fn, instance, type, args) {
        let res;
        try {
            res = args ? fn(...args) : fn();
        }
        catch (err) {
            handleError(err, instance, type);
        }
        return res;
    }
    function callWithAsyncErrorHandling(fn, instance, type, args) {
        if (isFunction(fn)) {
            const res = callWithErrorHandling(fn, instance, type, args);
            if (res && isPromise(res)) {
                res.catch(err => {
                    handleError(err, instance, type);
                });
            }
            return res;
        }
        const values = [];
        for (let i = 0; i < fn.length; i++) {
            values.push(callWithAsyncErrorHandling(fn[i], instance, type, args));
        }
        return values;
    }
    function handleError(err, instance, type, throwInDev = true) {
        const contextVNode = instance ? instance.vnode : null;
        if (instance) {
            let cur = instance.parent;
            // the exposed instance is the render proxy to keep it consistent with 2.x
            const exposedInstance = instance.proxy;
            // in production the hook receives only the error code
            const errorInfo = ErrorTypeStrings[type];
            while (cur) {
                const errorCapturedHooks = cur.ec;
                if (errorCapturedHooks) {
                    for (let i = 0; i < errorCapturedHooks.length; i++) {
                        if (errorCapturedHooks[i](err, exposedInstance, errorInfo) === false) {
                            return;
                        }
                    }
                }
                cur = cur.parent;
            }
            // app-level handling
            const appErrorHandler = instance.appContext.config.errorHandler;
            if (appErrorHandler) {
                callWithErrorHandling(appErrorHandler, null, 10 /* APP_ERROR_HANDLER */, [err, exposedInstance, errorInfo]);
                return;
            }
        }
        logError(err, type, contextVNode, throwInDev);
    }
    function logError(err, type, contextVNode, throwInDev = true) {
        {
            const info = ErrorTypeStrings[type];
            if (contextVNode) {
                pushWarningContext(contextVNode);
            }
            warn(`Unhandled error${info ? ` during execution of ${info}` : ``}`);
            if (contextVNode) {
                popWarningContext();
            }
            // crash in dev by default so it's more noticeable
            if (throwInDev) {
                throw err;
            }
            else {
                console.error(err);
            }
        }
    }

    let isFlushing = false;
    let isFlushPending = false;
    const queue = [];
    let flushIndex = 0;
    const pendingPreFlushCbs = [];
    let activePreFlushCbs = null;
    let preFlushIndex = 0;
    const pendingPostFlushCbs = [];
    let activePostFlushCbs = null;
    let postFlushIndex = 0;
    const resolvedPromise = Promise.resolve();
    let currentFlushPromise = null;
    let currentPreFlushParentJob = null;
    const RECURSION_LIMIT = 100;
    function nextTick(fn) {
        const p = currentFlushPromise || resolvedPromise;
        return fn ? p.then(this ? fn.bind(this) : fn) : p;
    }
    // #2768
    // Use binary-search to find a suitable position in the queue,
    // so that the queue maintains the increasing order of job's id,
    // which can prevent the job from being skipped and also can avoid repeated patching.
    function findInsertionIndex(job) {
        // the start index should be `flushIndex + 1`
        let start = flushIndex + 1;
        let end = queue.length;
        const jobId = getId(job);
        while (start < end) {
            const middle = (start + end) >>> 1;
            const middleJobId = getId(queue[middle]);
            middleJobId < jobId ? (start = middle + 1) : (end = middle);
        }
        return start;
    }
    function queueJob(job) {
        // the dedupe search uses the startIndex argument of Array.includes()
        // by default the search index includes the current job that is being run
        // so it cannot recursively trigger itself again.
        // if the job is a watch() callback, the search will start with a +1 index to
        // allow it recursively trigger itself - it is the user's responsibility to
        // ensure it doesn't end up in an infinite loop.
        if ((!queue.length ||
            !queue.includes(job, isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex)) &&
            job !== currentPreFlushParentJob) {
            const pos = findInsertionIndex(job);
            if (pos > -1) {
                queue.splice(pos, 0, job);
            }
            else {
                queue.push(job);
            }
            queueFlush();
        }
    }
    function queueFlush() {
        if (!isFlushing && !isFlushPending) {
            isFlushPending = true;
            currentFlushPromise = resolvedPromise.then(flushJobs);
        }
    }
    function queueCb(cb, activeQueue, pendingQueue, index) {
        if (!isArray(cb)) {
            if (!activeQueue ||
                !activeQueue.includes(cb, cb.allowRecurse ? index + 1 : index)) {
                pendingQueue.push(cb);
            }
        }
        else {
            // if cb is an array, it is a component lifecycle hook which can only be
            // triggered by a job, which is already deduped in the main queue, so
            // we can skip duplicate check here to improve perf
            pendingQueue.push(...cb);
        }
        queueFlush();
    }
    function queuePreFlushCb(cb) {
        queueCb(cb, activePreFlushCbs, pendingPreFlushCbs, preFlushIndex);
    }
    function queuePostFlushCb(cb) {
        queueCb(cb, activePostFlushCbs, pendingPostFlushCbs, postFlushIndex);
    }
    function flushPreFlushCbs(seen, parentJob = null) {
        if (pendingPreFlushCbs.length) {
            currentPreFlushParentJob = parentJob;
            activePreFlushCbs = [...new Set(pendingPreFlushCbs)];
            pendingPreFlushCbs.length = 0;
            {
                seen = seen || new Map();
            }
            for (preFlushIndex = 0; preFlushIndex < activePreFlushCbs.length; preFlushIndex++) {
                if (checkRecursiveUpdates(seen, activePreFlushCbs[preFlushIndex])) {
                    continue;
                }
                activePreFlushCbs[preFlushIndex]();
            }
            activePreFlushCbs = null;
            preFlushIndex = 0;
            currentPreFlushParentJob = null;
            // recursively flush until it drains
            flushPreFlushCbs(seen, parentJob);
        }
    }
    function flushPostFlushCbs(seen) {
        if (pendingPostFlushCbs.length) {
            const deduped = [...new Set(pendingPostFlushCbs)];
            pendingPostFlushCbs.length = 0;
            // #1947 already has active queue, nested flushPostFlushCbs call
            if (activePostFlushCbs) {
                activePostFlushCbs.push(...deduped);
                return;
            }
            activePostFlushCbs = deduped;
            {
                seen = seen || new Map();
            }
            activePostFlushCbs.sort((a, b) => getId(a) - getId(b));
            for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
                if (checkRecursiveUpdates(seen, activePostFlushCbs[postFlushIndex])) {
                    continue;
                }
                activePostFlushCbs[postFlushIndex]();
            }
            activePostFlushCbs = null;
            postFlushIndex = 0;
        }
    }
    const getId = (job) => job.id == null ? Infinity : job.id;
    function flushJobs(seen) {
        isFlushPending = false;
        isFlushing = true;
        {
            seen = seen || new Map();
        }
        flushPreFlushCbs(seen);
        // Sort queue before flush.
        // This ensures that:
        // 1. Components are updated from parent to child. (because parent is always
        //    created before the child so its render effect will have smaller
        //    priority number)
        // 2. If a component is unmounted during a parent component's update,
        //    its update can be skipped.
        queue.sort((a, b) => getId(a) - getId(b));
        try {
            for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
                const job = queue[flushIndex];
                if (job && job.active !== false) {
                    if (checkRecursiveUpdates(seen, job)) {
                        continue;
                    }
                    callWithErrorHandling(job, null, 14 /* SCHEDULER */);
                }
            }
        }
        finally {
            flushIndex = 0;
            queue.length = 0;
            flushPostFlushCbs(seen);
            isFlushing = false;
            currentFlushPromise = null;
            // some postFlushCb queued jobs!
            // keep flushing until it drains.
            if (queue.length ||
                pendingPreFlushCbs.length ||
                pendingPostFlushCbs.length) {
                flushJobs(seen);
            }
        }
    }
    function checkRecursiveUpdates(seen, fn) {
        if (!seen.has(fn)) {
            seen.set(fn, 1);
        }
        else {
            const count = seen.get(fn);
            if (count > RECURSION_LIMIT) {
                const instance = fn.ownerInstance;
                const componentName = instance && getComponentName(instance.type);
                warn(`Maximum recursive updates exceeded${componentName ? ` in component <${componentName}>` : ``}. ` +
                    `This means you have a reactive effect that is mutating its own ` +
                    `dependencies and thus recursively triggering itself. Possible sources ` +
                    `include component template, render function, updated hook or ` +
                    `watcher source function.`);
                return true;
            }
            else {
                seen.set(fn, count + 1);
            }
        }
    }
    const hmrDirtyComponents = new Set();
    // Expose the HMR runtime on the global object
    // This makes it entirely tree-shakable without polluting the exports and makes
    // it easier to be used in toolings like vue-loader
    // Note: for a component to be eligible for HMR it also needs the __hmrId option
    // to be set so that its instances can be registered / removed.
    {
        const globalObject = typeof global !== 'undefined'
            ? global
            : typeof self !== 'undefined'
                ? self
                : typeof window !== 'undefined'
                    ? window
                    : {};
        globalObject.__VUE_HMR_RUNTIME__ = {
            createRecord: tryWrap(createRecord),
            rerender: tryWrap(rerender),
            reload: tryWrap(reload)
        };
    }
    const map = new Map();
    function createRecord(id, component) {
        if (!component) {
            warn(`HMR API usage is out of date.\n` +
                `Please upgrade vue-loader/vite/rollup-plugin-vue or other relevant ` +
                `dependency that handles Vue SFC compilation.`);
            component = {};
        }
        if (map.has(id)) {
            return false;
        }
        map.set(id, {
            component: isClassComponent(component) ? component.__vccOpts : component,
            instances: new Set()
        });
        return true;
    }
    function rerender(id, newRender) {
        const record = map.get(id);
        if (!record)
            return;
        if (newRender)
            record.component.render = newRender;
        // Array.from creates a snapshot which avoids the set being mutated during
        // updates
        Array.from(record.instances).forEach(instance => {
            if (newRender) {
                instance.render = newRender;
            }
            instance.renderCache = [];
            instance.update();
        });
    }
    function reload(id, newComp) {
        const record = map.get(id);
        if (!record)
            return;
        // Array.from creates a snapshot which avoids the set being mutated during
        // updates
        const { component, instances } = record;
        if (!hmrDirtyComponents.has(component)) {
            // 1. Update existing comp definition to match new one
            newComp = isClassComponent(newComp) ? newComp.__vccOpts : newComp;
            extend(component, newComp);
            for (const key in component) {
                if (key !== '__file' && !(key in newComp)) {
                    delete component[key];
                }
            }
            // 2. Mark component dirty. This forces the renderer to replace the component
            // on patch.
            hmrDirtyComponents.add(component);
            // 3. Make sure to unmark the component after the reload.
            queuePostFlushCb(() => {
                hmrDirtyComponents.delete(component);
            });
        }
        Array.from(instances).forEach(instance => {
            if (instance.parent) {
                // 4. Force the parent instance to re-render. This will cause all updated
                // components to be unmounted and re-mounted. Queue the update so that we
                // don't end up forcing the same parent to re-render multiple times.
                queueJob(instance.parent.update);
            }
            else if (instance.appContext.reload) {
                // root instance mounted via createApp() has a reload method
                instance.appContext.reload();
            }
            else if (typeof window !== 'undefined') {
                // root instance inside tree created via raw render(). Force reload.
                window.location.reload();
            }
            else {
                console.warn('[HMR] Root or manually mounted instance modified. Full reload required.');
            }
        });
    }
    function tryWrap(fn) {
        return (id, arg) => {
            try {
                return fn(id, arg);
            }
            catch (e) {
                console.error(e);
                console.warn(`[HMR] Something went wrong during Vue component hot-reload. ` +
                    `Full reload required.`);
            }
        };
    }

    /**
     * mark the current rendering instance for asset resolution (e.g.
     * resolveComponent, resolveDirective) during render
     */
    let currentRenderingInstance = null;
    let currentScopeId = null;

    const isSuspense = (type) => type.__isSuspense;
    function queueEffectWithSuspense(fn, suspense) {
        if (suspense && suspense.pendingBranch) {
            if (isArray(fn)) {
                suspense.effects.push(...fn);
            }
            else {
                suspense.effects.push(fn);
            }
        }
        else {
            queuePostFlushCb(fn);
        }
    }
    // initial value for watchers to trigger on undefined initial values
    const INITIAL_WATCHER_VALUE = {};
    function doWatch(source, cb, { immediate, deep, flush, onTrack, onTrigger } = EMPTY_OBJ, instance = currentInstance) {
        if (!cb) {
            if (immediate !== undefined) {
                warn(`watch() "immediate" option is only respected when using the ` +
                    `watch(source, callback, options?) signature.`);
            }
            if (deep !== undefined) {
                warn(`watch() "deep" option is only respected when using the ` +
                    `watch(source, callback, options?) signature.`);
            }
        }
        const warnInvalidSource = (s) => {
            warn(`Invalid watch source: `, s, `A watch source can only be a getter/effect function, a ref, ` +
                `a reactive object, or an array of these types.`);
        };
        let getter;
        let forceTrigger = false;
        let isMultiSource = false;
        if (isRef(source)) {
            getter = () => source.value;
            forceTrigger = !!source._shallow;
        }
        else if (isReactive(source)) {
            getter = () => source;
            deep = true;
        }
        else if (isArray(source)) {
            isMultiSource = true;
            forceTrigger = source.some(isReactive);
            getter = () => source.map(s => {
                if (isRef(s)) {
                    return s.value;
                }
                else if (isReactive(s)) {
                    return traverse(s);
                }
                else if (isFunction(s)) {
                    return callWithErrorHandling(s, instance, 2 /* WATCH_GETTER */);
                }
                else {
                    warnInvalidSource(s);
                }
            });
        }
        else if (isFunction(source)) {
            if (cb) {
                // getter with cb
                getter = () => callWithErrorHandling(source, instance, 2 /* WATCH_GETTER */);
            }
            else {
                // no cb -> simple effect
                getter = () => {
                    if (instance && instance.isUnmounted) {
                        return;
                    }
                    if (cleanup) {
                        cleanup();
                    }
                    return callWithAsyncErrorHandling(source, instance, 3 /* WATCH_CALLBACK */, [onInvalidate]);
                };
            }
        }
        else {
            getter = NOOP;
            warnInvalidSource(source);
        }
        if (cb && deep) {
            const baseGetter = getter;
            getter = () => traverse(baseGetter());
        }
        let cleanup;
        let onInvalidate = (fn) => {
            cleanup = runner.options.onStop = () => {
                callWithErrorHandling(fn, instance, 4 /* WATCH_CLEANUP */);
            };
        };
        let oldValue = isMultiSource ? [] : INITIAL_WATCHER_VALUE;
        const job = () => {
            if (!runner.active) {
                return;
            }
            if (cb) {
                // watch(source, cb)
                const newValue = runner();
                if (deep ||
                    forceTrigger ||
                    (isMultiSource
                        ? newValue.some((v, i) => hasChanged(v, oldValue[i]))
                        : hasChanged(newValue, oldValue)) ||
                    (false  )) {
                    // cleanup before running cb again
                    if (cleanup) {
                        cleanup();
                    }
                    callWithAsyncErrorHandling(cb, instance, 3 /* WATCH_CALLBACK */, [
                        newValue,
                        // pass undefined as the old value when it's changed for the first time
                        oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
                        onInvalidate
                    ]);
                    oldValue = newValue;
                }
            }
            else {
                // watchEffect
                runner();
            }
        };
        // important: mark the job as a watcher callback so that scheduler knows
        // it is allowed to self-trigger (#1727)
        job.allowRecurse = !!cb;
        let scheduler;
        if (flush === 'sync') {
            scheduler = job; // the scheduler function gets called directly
        }
        else if (flush === 'post') {
            scheduler = () => queuePostRenderEffect(job, instance && instance.suspense);
        }
        else {
            // default: 'pre'
            scheduler = () => {
                if (!instance || instance.isMounted) {
                    queuePreFlushCb(job);
                }
                else {
                    // with 'pre' option, the first call must happen before
                    // the component is mounted so it is called synchronously.
                    job();
                }
            };
        }
        const runner = effect(getter, {
            lazy: true,
            onTrack,
            onTrigger,
            scheduler
        });
        recordInstanceBoundEffect(runner, instance);
        // initial run
        if (cb) {
            if (immediate) {
                job();
            }
            else {
                oldValue = runner();
            }
        }
        else if (flush === 'post') {
            queuePostRenderEffect(runner, instance && instance.suspense);
        }
        else {
            runner();
        }
        return () => {
            stop(runner);
            if (instance) {
                remove(instance.effects, runner);
            }
        };
    }
    // this.$watch
    function instanceWatch(source, value, options) {
        const publicThis = this.proxy;
        const getter = isString(source)
            ? source.includes('.')
                ? createPathGetter(publicThis, source)
                : () => publicThis[source]
            : source.bind(publicThis, publicThis);
        let cb;
        if (isFunction(value)) {
            cb = value;
        }
        else {
            cb = value.handler;
            options = value;
        }
        return doWatch(getter, cb.bind(publicThis), options, this);
    }
    function createPathGetter(ctx, path) {
        const segments = path.split('.');
        return () => {
            let cur = ctx;
            for (let i = 0; i < segments.length && cur; i++) {
                cur = cur[segments[i]];
            }
            return cur;
        };
    }
    function traverse(value, seen = new Set()) {
        if (!isObject(value) ||
            seen.has(value) ||
            value["__v_skip" /* SKIP */]) {
            return value;
        }
        seen.add(value);
        if (isRef(value)) {
            traverse(value.value, seen);
        }
        else if (isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                traverse(value[i], seen);
            }
        }
        else if (isSet(value) || isMap(value)) {
            value.forEach((v) => {
                traverse(v, seen);
            });
        }
        else if (isPlainObject(value)) {
            for (const key in value) {
                traverse(value[key], seen);
            }
        }
        return value;
    }

    function useTransitionState() {
        const state = {
            isMounted: false,
            isLeaving: false,
            isUnmounting: false,
            leavingVNodes: new Map()
        };
        onMounted(() => {
            state.isMounted = true;
        });
        onBeforeUnmount(() => {
            state.isUnmounting = true;
        });
        return state;
    }
    const TransitionHookValidator = [Function, Array];
    const BaseTransitionImpl = {
        name: `BaseTransition`,
        props: {
            mode: String,
            appear: Boolean,
            persisted: Boolean,
            // enter
            onBeforeEnter: TransitionHookValidator,
            onEnter: TransitionHookValidator,
            onAfterEnter: TransitionHookValidator,
            onEnterCancelled: TransitionHookValidator,
            // leave
            onBeforeLeave: TransitionHookValidator,
            onLeave: TransitionHookValidator,
            onAfterLeave: TransitionHookValidator,
            onLeaveCancelled: TransitionHookValidator,
            // appear
            onBeforeAppear: TransitionHookValidator,
            onAppear: TransitionHookValidator,
            onAfterAppear: TransitionHookValidator,
            onAppearCancelled: TransitionHookValidator
        },
        setup(props, { slots }) {
            const instance = getCurrentInstance();
            const state = useTransitionState();
            let prevTransitionKey;
            return () => {
                const children = slots.default && getTransitionRawChildren(slots.default(), true);
                if (!children || !children.length) {
                    return;
                }
                // warn multiple elements
                if (children.length > 1) {
                    warn('<transition> can only be used on a single element or component. Use ' +
                        '<transition-group> for lists.');
                }
                // there's no need to track reactivity for these props so use the raw
                // props for a bit better perf
                const rawProps = toRaw(props);
                const { mode } = rawProps;
                // check mode
                if (mode && !['in-out', 'out-in', 'default'].includes(mode)) {
                    warn(`invalid <transition> mode: ${mode}`);
                }
                // at this point children has a guaranteed length of 1.
                const child = children[0];
                if (state.isLeaving) {
                    return emptyPlaceholder(child);
                }
                // in the case of <transition><keep-alive/></transition>, we need to
                // compare the type of the kept-alive children.
                const innerChild = getKeepAliveChild(child);
                if (!innerChild) {
                    return emptyPlaceholder(child);
                }
                const enterHooks = resolveTransitionHooks(innerChild, rawProps, state, instance);
                setTransitionHooks(innerChild, enterHooks);
                const oldChild = instance.subTree;
                const oldInnerChild = oldChild && getKeepAliveChild(oldChild);
                let transitionKeyChanged = false;
                const { getTransitionKey } = innerChild.type;
                if (getTransitionKey) {
                    const key = getTransitionKey();
                    if (prevTransitionKey === undefined) {
                        prevTransitionKey = key;
                    }
                    else if (key !== prevTransitionKey) {
                        prevTransitionKey = key;
                        transitionKeyChanged = true;
                    }
                }
                // handle mode
                if (oldInnerChild &&
                    oldInnerChild.type !== Comment$1 &&
                    (!isSameVNodeType(innerChild, oldInnerChild) || transitionKeyChanged)) {
                    const leavingHooks = resolveTransitionHooks(oldInnerChild, rawProps, state, instance);
                    // update old tree's hooks in case of dynamic transition
                    setTransitionHooks(oldInnerChild, leavingHooks);
                    // switching between different views
                    if (mode === 'out-in') {
                        state.isLeaving = true;
                        // return placeholder node and queue update when leave finishes
                        leavingHooks.afterLeave = () => {
                            state.isLeaving = false;
                            instance.update();
                        };
                        return emptyPlaceholder(child);
                    }
                    else if (mode === 'in-out' && innerChild.type !== Comment$1) {
                        leavingHooks.delayLeave = (el, earlyRemove, delayedLeave) => {
                            const leavingVNodesCache = getLeavingNodesForType(state, oldInnerChild);
                            leavingVNodesCache[String(oldInnerChild.key)] = oldInnerChild;
                            // early removal callback
                            el._leaveCb = () => {
                                earlyRemove();
                                el._leaveCb = undefined;
                                delete enterHooks.delayedLeave;
                            };
                            enterHooks.delayedLeave = delayedLeave;
                        };
                    }
                }
                return child;
            };
        }
    };
    // export the public type for h/tsx inference
    // also to avoid inline import() in generated d.ts files
    const BaseTransition = BaseTransitionImpl;
    function getLeavingNodesForType(state, vnode) {
        const { leavingVNodes } = state;
        let leavingVNodesCache = leavingVNodes.get(vnode.type);
        if (!leavingVNodesCache) {
            leavingVNodesCache = Object.create(null);
            leavingVNodes.set(vnode.type, leavingVNodesCache);
        }
        return leavingVNodesCache;
    }
    // The transition hooks are attached to the vnode as vnode.transition
    // and will be called at appropriate timing in the renderer.
    function resolveTransitionHooks(vnode, props, state, instance) {
        const { appear, mode, persisted = false, onBeforeEnter, onEnter, onAfterEnter, onEnterCancelled, onBeforeLeave, onLeave, onAfterLeave, onLeaveCancelled, onBeforeAppear, onAppear, onAfterAppear, onAppearCancelled } = props;
        const key = String(vnode.key);
        const leavingVNodesCache = getLeavingNodesForType(state, vnode);
        const callHook = (hook, args) => {
            hook &&
                callWithAsyncErrorHandling(hook, instance, 9 /* TRANSITION_HOOK */, args);
        };
        const hooks = {
            mode,
            persisted,
            beforeEnter(el) {
                let hook = onBeforeEnter;
                if (!state.isMounted) {
                    if (appear) {
                        hook = onBeforeAppear || onBeforeEnter;
                    }
                    else {
                        return;
                    }
                }
                // for same element (v-show)
                if (el._leaveCb) {
                    el._leaveCb(true /* cancelled */);
                }
                // for toggled element with same key (v-if)
                const leavingVNode = leavingVNodesCache[key];
                if (leavingVNode &&
                    isSameVNodeType(vnode, leavingVNode) &&
                    leavingVNode.el._leaveCb) {
                    // force early removal (not cancelled)
                    leavingVNode.el._leaveCb();
                }
                callHook(hook, [el]);
            },
            enter(el) {
                let hook = onEnter;
                let afterHook = onAfterEnter;
                let cancelHook = onEnterCancelled;
                if (!state.isMounted) {
                    if (appear) {
                        hook = onAppear || onEnter;
                        afterHook = onAfterAppear || onAfterEnter;
                        cancelHook = onAppearCancelled || onEnterCancelled;
                    }
                    else {
                        return;
                    }
                }
                let called = false;
                const done = (el._enterCb = (cancelled) => {
                    if (called)
                        return;
                    called = true;
                    if (cancelled) {
                        callHook(cancelHook, [el]);
                    }
                    else {
                        callHook(afterHook, [el]);
                    }
                    if (hooks.delayedLeave) {
                        hooks.delayedLeave();
                    }
                    el._enterCb = undefined;
                });
                if (hook) {
                    hook(el, done);
                    if (hook.length <= 1) {
                        done();
                    }
                }
                else {
                    done();
                }
            },
            leave(el, remove$$1) {
                const key = String(vnode.key);
                if (el._enterCb) {
                    el._enterCb(true /* cancelled */);
                }
                if (state.isUnmounting) {
                    return remove$$1();
                }
                callHook(onBeforeLeave, [el]);
                let called = false;
                const done = (el._leaveCb = (cancelled) => {
                    if (called)
                        return;
                    called = true;
                    remove$$1();
                    if (cancelled) {
                        callHook(onLeaveCancelled, [el]);
                    }
                    else {
                        callHook(onAfterLeave, [el]);
                    }
                    el._leaveCb = undefined;
                    if (leavingVNodesCache[key] === vnode) {
                        delete leavingVNodesCache[key];
                    }
                });
                leavingVNodesCache[key] = vnode;
                if (onLeave) {
                    onLeave(el, done);
                    if (onLeave.length <= 1) {
                        done();
                    }
                }
                else {
                    done();
                }
            },
            clone(vnode) {
                return resolveTransitionHooks(vnode, props, state, instance);
            }
        };
        return hooks;
    }
    // the placeholder really only handles one special case: KeepAlive
    // in the case of a KeepAlive in a leave phase we need to return a KeepAlive
    // placeholder with empty content to avoid the KeepAlive instance from being
    // unmounted.
    function emptyPlaceholder(vnode) {
        if (isKeepAlive(vnode)) {
            vnode = cloneVNode(vnode);
            vnode.children = null;
            return vnode;
        }
    }
    function getKeepAliveChild(vnode) {
        return isKeepAlive(vnode)
            ? vnode.children
                ? vnode.children[0]
                : undefined
            : vnode;
    }
    function setTransitionHooks(vnode, hooks) {
        if (vnode.shapeFlag & 6 /* COMPONENT */ && vnode.component) {
            setTransitionHooks(vnode.component.subTree, hooks);
        }
        else if (vnode.shapeFlag & 128 /* SUSPENSE */) {
            vnode.ssContent.transition = hooks.clone(vnode.ssContent);
            vnode.ssFallback.transition = hooks.clone(vnode.ssFallback);
        }
        else {
            vnode.transition = hooks;
        }
    }
    function getTransitionRawChildren(children, keepComment = false) {
        let ret = [];
        let keyedFragmentCount = 0;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            // handle fragment children case, e.g. v-for
            if (child.type === Fragment) {
                if (child.patchFlag & 128 /* KEYED_FRAGMENT */)
                    keyedFragmentCount++;
                ret = ret.concat(getTransitionRawChildren(child.children, keepComment));
            }
            // comment placeholders should be skipped, e.g. v-if
            else if (keepComment || child.type !== Comment$1) {
                ret.push(child);
            }
        }
        // #1126 if a transition children list contains multiple sub fragments, these
        // fragments will be merged into a flat children array. Since each v-for
        // fragment may contain different static bindings inside, we need to de-op
        // these children to force full diffs to ensure correct behavior.
        if (keyedFragmentCount > 1) {
            for (let i = 0; i < ret.length; i++) {
                ret[i].patchFlag = -2 /* BAIL */;
            }
        }
        return ret;
    }

    const isKeepAlive = (vnode) => vnode.type.__isKeepAlive;

    function injectHook(type, hook, target = currentInstance, prepend = false) {
        if (target) {
            const hooks = target[type] || (target[type] = []);
            // cache the error handling wrapper for injected hooks so the same hook
            // can be properly deduped by the scheduler. "__weh" stands for "with error
            // handling".
            const wrappedHook = hook.__weh ||
                (hook.__weh = (...args) => {
                    if (target.isUnmounted) {
                        return;
                    }
                    // disable tracking inside all lifecycle hooks
                    // since they can potentially be called inside effects.
                    pauseTracking();
                    // Set currentInstance during hook invocation.
                    // This assumes the hook does not synchronously trigger other hooks, which
                    // can only be false when the user does something really funky.
                    setCurrentInstance(target);
                    const res = callWithAsyncErrorHandling(hook, target, type, args);
                    setCurrentInstance(null);
                    resetTracking();
                    return res;
                });
            if (prepend) {
                hooks.unshift(wrappedHook);
            }
            else {
                hooks.push(wrappedHook);
            }
            return wrappedHook;
        }
        else {
            const apiName = toHandlerKey(ErrorTypeStrings[type].replace(/ hook$/, ''));
            warn(`${apiName} is called when there is no active component instance to be ` +
                `associated with. ` +
                `Lifecycle injection APIs can only be used during execution of setup().` +
                (` If you are using async setup(), make sure to register lifecycle ` +
                        `hooks before the first await statement.`
                    ));
        }
    }
    const createHook = (lifecycle) => (hook, target = currentInstance) => 
    // post-create lifecycle registrations are noops during SSR (except for serverPrefetch)
    (!isInSSRComponentSetup || lifecycle === "sp" /* SERVER_PREFETCH */) &&
        injectHook(lifecycle, hook, target);
    const onMounted = createHook("m" /* MOUNTED */);
    const onUpdated = createHook("u" /* UPDATED */);
    const onBeforeUnmount = createHook("bum" /* BEFORE_UNMOUNT */);
    let shouldCacheAccess = true;
    /**
     * Resolve merged options and cache it on the component.
     * This is done only once per-component since the merging does not involve
     * instances.
     */
    function resolveMergedOptions(instance) {
        const base = instance.type;
        const { mixins, extends: extendsOptions } = base;
        const { mixins: globalMixins, optionsCache: cache, config: { optionMergeStrategies } } = instance.appContext;
        const cached = cache.get(base);
        let resolved;
        if (cached) {
            resolved = cached;
        }
        else if (!globalMixins.length && !mixins && !extendsOptions) {
            {
                resolved = base;
            }
        }
        else {
            resolved = {};
            if (globalMixins.length) {
                globalMixins.forEach(m => mergeOptions(resolved, m, optionMergeStrategies, true));
            }
            mergeOptions(resolved, base, optionMergeStrategies);
        }
        cache.set(base, resolved);
        return resolved;
    }
    function mergeOptions(to, from, strats, asMixin = false) {
        const { mixins, extends: extendsOptions } = from;
        if (extendsOptions) {
            mergeOptions(to, extendsOptions, strats, true);
        }
        if (mixins) {
            mixins.forEach((m) => mergeOptions(to, m, strats, true));
        }
        for (const key in from) {
            if (asMixin && key === 'expose') {
                warn(`"expose" option is ignored when declared in mixins or extends. ` +
                        `It should only be declared in the base component itself.`);
            }
            else {
                const strat = internalOptionMergeStrats[key] || (strats && strats[key]);
                to[key] = strat ? strat(to[key], from[key]) : from[key];
            }
        }
        return to;
    }
    const internalOptionMergeStrats = {
        data: mergeDataFn,
        props: mergeObjectOptions,
        emits: mergeObjectOptions,
        // objects
        methods: mergeObjectOptions,
        computed: mergeObjectOptions,
        // lifecycle
        beforeCreate: mergeHook,
        created: mergeHook,
        beforeMount: mergeHook,
        mounted: mergeHook,
        beforeUpdate: mergeHook,
        updated: mergeHook,
        beforeDestroy: mergeHook,
        destroyed: mergeHook,
        activated: mergeHook,
        deactivated: mergeHook,
        errorCaptured: mergeHook,
        serverPrefetch: mergeHook,
        // assets
        components: mergeObjectOptions,
        directives: mergeObjectOptions,
        // watch has special merge behavior in v2, but isn't actually needed in v3.
        // since we are only exposing these for compat and nobody should be relying
        // on the watch-specific behavior, just expose the object merge strat.
        watch: mergeObjectOptions,
        // provide / inject
        provide: mergeDataFn,
        inject: mergeInject
    };
    function mergeDataFn(to, from) {
        if (!from) {
            return to;
        }
        if (!to) {
            return from;
        }
        return function mergedDataFn() {
            return (extend)(isFunction(to) ? to.call(this, this) : to, isFunction(from) ? from.call(this, this) : from);
        };
    }
    function mergeInject(to, from) {
        return mergeObjectOptions(normalizeInject(to), normalizeInject(from));
    }
    function normalizeInject(raw) {
        if (isArray(raw)) {
            const res = {};
            for (let i = 0; i < raw.length; i++) {
                res[raw[i]] = raw[i];
            }
            return res;
        }
        return raw;
    }
    function mergeHook(to, from) {
        return to ? [...new Set([].concat(to, from))] : from;
    }
    function mergeObjectOptions(to, from) {
        return to ? extend(extend(Object.create(null), to), from) : from;
    }
    const isSimpleType = /*#__PURE__*/ makeMap('String,Number,Boolean,Function,Symbol,BigInt');

    /**
    Runtime helper for applying directives to a vnode. Example usage:

    const comp = resolveComponent('comp')
    const foo = resolveDirective('foo')
    const bar = resolveDirective('bar')

    return withDirectives(h(comp), [
      [foo, this.x],
      [bar, this.y]
    ])
    */
    const isBuiltInDirective = /*#__PURE__*/ makeMap('bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text');
    const queuePostRenderEffect = queueEffectWithSuspense
        ;

    const isTeleport = (type) => type.__isTeleport;
    const NULL_DYNAMIC_COMPONENT = Symbol();

    const Fragment = Symbol('Fragment');
    const Text = Symbol('Text');
    const Comment$1 = Symbol('Comment');
    let currentBlock = null;
    // Whether we should be tracking dynamic child nodes inside a block.
    // Only tracks when this value is > 0
    // We are not using a simple boolean because this value may need to be
    // incremented/decremented by nested usage of v-once (see below)
    let isBlockTreeEnabled = 1;
    function isVNode(value) {
        return value ? value.__v_isVNode === true : false;
    }
    function isSameVNodeType(n1, n2) {
        if (n2.shapeFlag & 6 /* COMPONENT */ &&
            hmrDirtyComponents.has(n2.type)) {
            // HMR only: if the component has been hot-updated, force a reload.
            return false;
        }
        return n1.type === n2.type && n1.key === n2.key;
    }
    let vnodeArgsTransformer;
    const createVNodeWithArgsTransform = (...args) => {
        return _createVNode(...(vnodeArgsTransformer
            ? vnodeArgsTransformer(args, currentRenderingInstance)
            : args));
    };
    const InternalObjectKey = `__vInternal`;
    const normalizeKey = ({ key }) => key != null ? key : null;
    const normalizeRef = ({ ref: ref$$1 }) => {
        return (ref$$1 != null
            ? isString(ref$$1) || isRef(ref$$1) || isFunction(ref$$1)
                ? { i: currentRenderingInstance, r: ref$$1 }
                : ref$$1
            : null);
    };
    const createVNode = (createVNodeWithArgsTransform);
    function _createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, isBlockNode = false) {
        if (!type || type === NULL_DYNAMIC_COMPONENT) {
            if (!type) {
                warn(`Invalid vnode type when creating vnode: ${type}.`);
            }
            type = Comment$1;
        }
        if (isVNode(type)) {
            // createVNode receiving an existing vnode. This happens in cases like
            // <component :is="vnode"/>
            // #2078 make sure to merge refs during the clone instead of overwriting it
            const cloned = cloneVNode(type, props, true /* mergeRef: true */);
            if (children) {
                normalizeChildren(cloned, children);
            }
            return cloned;
        }
        // class component normalization.
        if (isClassComponent(type)) {
            type = type.__vccOpts;
        }
        // class & style normalization.
        if (props) {
            // for reactive or proxy objects, we need to clone it to enable mutation.
            if (isProxy(props) || InternalObjectKey in props) {
                props = extend({}, props);
            }
            let { class: klass, style } = props;
            if (klass && !isString(klass)) {
                props.class = normalizeClass(klass);
            }
            if (isObject(style)) {
                // reactive state objects need to be cloned since they are likely to be
                // mutated
                if (isProxy(style) && !isArray(style)) {
                    style = extend({}, style);
                }
                props.style = normalizeStyle(style);
            }
        }
        // encode the vnode type information into a bitmap
        const shapeFlag = isString(type)
            ? 1 /* ELEMENT */
            : isSuspense(type)
                ? 128 /* SUSPENSE */
                : isTeleport(type)
                    ? 64 /* TELEPORT */
                    : isObject(type)
                        ? 4 /* STATEFUL_COMPONENT */
                        : isFunction(type)
                            ? 2 /* FUNCTIONAL_COMPONENT */
                            : 0;
        if (shapeFlag & 4 /* STATEFUL_COMPONENT */ && isProxy(type)) {
            type = toRaw(type);
            warn(`Vue received a Component which was made a reactive object. This can ` +
                `lead to unnecessary performance overhead, and should be avoided by ` +
                `marking the component with \`markRaw\` or using \`shallowRef\` ` +
                `instead of \`ref\`.`, `\nComponent that was made reactive: `, type);
        }
        const vnode = {
            __v_isVNode: true,
            __v_skip: true,
            type,
            props,
            key: props && normalizeKey(props),
            ref: props && normalizeRef(props),
            scopeId: currentScopeId,
            slotScopeIds: null,
            children: null,
            component: null,
            suspense: null,
            ssContent: null,
            ssFallback: null,
            dirs: null,
            transition: null,
            el: null,
            anchor: null,
            target: null,
            targetAnchor: null,
            staticCount: 0,
            shapeFlag,
            patchFlag,
            dynamicProps,
            dynamicChildren: null,
            appContext: null
        };
        // validate key
        if (vnode.key !== vnode.key) {
            warn(`VNode created with invalid key (NaN). VNode type:`, vnode.type);
        }
        normalizeChildren(vnode, children);
        // normalize suspense children
        if (shapeFlag & 128 /* SUSPENSE */) {
            type.normalize(vnode);
        }
        if (isBlockTreeEnabled > 0 &&
            // avoid a block node from tracking itself
            !isBlockNode &&
            // has current parent block
            currentBlock &&
            // presence of a patch flag indicates this node needs patching on updates.
            // component nodes also should always be patched, because even if the
            // component doesn't need to update, it needs to persist the instance on to
            // the next vnode so that it can be properly unmounted later.
            (patchFlag > 0 || shapeFlag & 6 /* COMPONENT */) &&
            // the EVENTS flag is only for hydration and if it is the only flag, the
            // vnode should not be considered dynamic due to handler caching.
            patchFlag !== 32 /* HYDRATE_EVENTS */) {
            currentBlock.push(vnode);
        }
        return vnode;
    }
    function cloneVNode(vnode, extraProps, mergeRef = false) {
        // This is intentionally NOT using spread or extend to avoid the runtime
        // key enumeration cost.
        const { props, ref: ref$$1, patchFlag, children } = vnode;
        const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props;
        const cloned = {
            __v_isVNode: true,
            __v_skip: true,
            type: vnode.type,
            props: mergedProps,
            key: mergedProps && normalizeKey(mergedProps),
            ref: extraProps && extraProps.ref
                ? // #2078 in the case of <component :is="vnode" ref="extra"/>
                    // if the vnode itself already has a ref, cloneVNode will need to merge
                    // the refs so the single vnode can be set on multiple refs
                    mergeRef && ref$$1
                        ? isArray(ref$$1)
                            ? ref$$1.concat(normalizeRef(extraProps))
                            : [ref$$1, normalizeRef(extraProps)]
                        : normalizeRef(extraProps)
                : ref$$1,
            scopeId: vnode.scopeId,
            slotScopeIds: vnode.slotScopeIds,
            children: patchFlag === -1 /* HOISTED */ && isArray(children)
                ? children.map(deepCloneVNode)
                : children,
            target: vnode.target,
            targetAnchor: vnode.targetAnchor,
            staticCount: vnode.staticCount,
            shapeFlag: vnode.shapeFlag,
            // if the vnode is cloned with extra props, we can no longer assume its
            // existing patch flag to be reliable and need to add the FULL_PROPS flag.
            // note: perserve flag for fragments since they use the flag for children
            // fast paths only.
            patchFlag: extraProps && vnode.type !== Fragment
                ? patchFlag === -1 // hoisted node
                    ? 16 /* FULL_PROPS */
                    : patchFlag | 16 /* FULL_PROPS */
                : patchFlag,
            dynamicProps: vnode.dynamicProps,
            dynamicChildren: vnode.dynamicChildren,
            appContext: vnode.appContext,
            dirs: vnode.dirs,
            transition: vnode.transition,
            // These should technically only be non-null on mounted VNodes. However,
            // they *should* be copied for kept-alive vnodes. So we just always copy
            // them since them being non-null during a mount doesn't affect the logic as
            // they will simply be overwritten.
            component: vnode.component,
            suspense: vnode.suspense,
            ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
            ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
            el: vnode.el,
            anchor: vnode.anchor
        };
        return cloned;
    }
    /**
     * Dev only, for HMR of hoisted vnodes reused in v-for
     * https://github.com/vitejs/vite/issues/2022
     */
    function deepCloneVNode(vnode) {
        const cloned = cloneVNode(vnode);
        if (isArray(vnode.children)) {
            cloned.children = vnode.children.map(deepCloneVNode);
        }
        return cloned;
    }
    /**
     * @private
     */
    function createTextVNode(text = ' ', flag = 0) {
        return createVNode(Text, null, text, flag);
    }
    function normalizeChildren(vnode, children) {
        let type = 0;
        const { shapeFlag } = vnode;
        if (children == null) {
            children = null;
        }
        else if (isArray(children)) {
            type = 16 /* ARRAY_CHILDREN */;
        }
        else if (typeof children === 'object') {
            if (shapeFlag & 1 /* ELEMENT */ || shapeFlag & 64 /* TELEPORT */) {
                // Normalize slot to plain children for plain element and Teleport
                const slot = children.default;
                if (slot) {
                    // _c marker is added by withCtx() indicating this is a compiled slot
                    slot._c && (slot._d = false);
                    normalizeChildren(vnode, slot());
                    slot._c && (slot._d = true);
                }
                return;
            }
            else {
                type = 32 /* SLOTS_CHILDREN */;
                const slotFlag = children._;
                if (!slotFlag && !(InternalObjectKey in children)) {
                    children._ctx = currentRenderingInstance;
                }
                else if (slotFlag === 3 /* FORWARDED */ && currentRenderingInstance) {
                    // a child component receives forwarded slots from the parent.
                    // its slot type is determined by its parent's slot type.
                    if (currentRenderingInstance.slots._ === 1 /* STABLE */) {
                        children._ = 1 /* STABLE */;
                    }
                    else {
                        children._ = 2 /* DYNAMIC */;
                        vnode.patchFlag |= 1024 /* DYNAMIC_SLOTS */;
                    }
                }
            }
        }
        else if (isFunction(children)) {
            children = { default: children, _ctx: currentRenderingInstance };
            type = 32 /* SLOTS_CHILDREN */;
        }
        else {
            children = String(children);
            // force teleport children to array so it can be moved around
            if (shapeFlag & 64 /* TELEPORT */) {
                type = 16 /* ARRAY_CHILDREN */;
                children = [createTextVNode(children)];
            }
            else {
                type = 8 /* TEXT_CHILDREN */;
            }
        }
        vnode.children = children;
        vnode.shapeFlag |= type;
    }
    function mergeProps(...args) {
        const ret = extend({}, args[0]);
        for (let i = 1; i < args.length; i++) {
            const toMerge = args[i];
            for (const key in toMerge) {
                if (key === 'class') {
                    if (ret.class !== toMerge.class) {
                        ret.class = normalizeClass([ret.class, toMerge.class]);
                    }
                }
                else if (key === 'style') {
                    ret.style = normalizeStyle([ret.style, toMerge.style]);
                }
                else if (isOn(key)) {
                    const existing = ret[key];
                    const incoming = toMerge[key];
                    if (existing !== incoming) {
                        ret[key] = existing
                            ? [].concat(existing, incoming)
                            : incoming;
                    }
                }
                else if (key !== '') {
                    ret[key] = toMerge[key];
                }
            }
        }
        return ret;
    }

    /**
     * #2437 In Vue 3, functional components do not have a public instance proxy but
     * they exist in the internal parent chain. For code that relies on traversing
     * public $parent chains, skip functional ones and go to the parent instead.
     */
    const getPublicInstance = (i) => {
        if (!i)
            return null;
        if (isStatefulComponent(i))
            return i.exposed ? i.exposed : i.proxy;
        return getPublicInstance(i.parent);
    };
    const publicPropertiesMap = extend(Object.create(null), {
        $: i => i,
        $el: i => i.vnode.el,
        $data: i => i.data,
        $props: i => (shallowReadonly(i.props)),
        $attrs: i => (shallowReadonly(i.attrs)),
        $slots: i => (shallowReadonly(i.slots)),
        $refs: i => (shallowReadonly(i.refs)),
        $parent: i => getPublicInstance(i.parent),
        $root: i => getPublicInstance(i.root),
        $emit: i => i.emit,
        $options: i => (__VUE_OPTIONS_API__ ? resolveMergedOptions(i) : i.type),
        $forceUpdate: i => () => queueJob(i.update),
        $nextTick: i => nextTick.bind(i.proxy),
        $watch: i => (__VUE_OPTIONS_API__ ? instanceWatch.bind(i) : NOOP)
    });
    const PublicInstanceProxyHandlers = {
        get({ _: instance }, key) {
            const { ctx, setupState, data, props, accessCache, type, appContext } = instance;
            // let @vue/reactivity know it should never observe Vue public instances.
            if (key === "__v_skip" /* SKIP */) {
                return true;
            }
            // for internal formatters to know that this is a Vue instance
            if (key === '__isVue') {
                return true;
            }
            // data / props / ctx
            // This getter gets called for every property access on the render context
            // during render and is a major hotspot. The most expensive part of this
            // is the multiple hasOwn() calls. It's much faster to do a simple property
            // access on a plain object, so we use an accessCache object (with null
            // prototype) to memoize what access type a key corresponds to.
            let normalizedProps;
            if (key[0] !== '$') {
                const n = accessCache[key];
                if (n !== undefined) {
                    switch (n) {
                        case 0 /* SETUP */:
                            return setupState[key];
                        case 1 /* DATA */:
                            return data[key];
                        case 3 /* CONTEXT */:
                            return ctx[key];
                        case 2 /* PROPS */:
                            return props[key];
                        // default: just fallthrough
                    }
                }
                else if (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) {
                    accessCache[key] = 0 /* SETUP */;
                    return setupState[key];
                }
                else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
                    accessCache[key] = 1 /* DATA */;
                    return data[key];
                }
                else if (
                // only cache other properties when instance has declared (thus stable)
                // props
                (normalizedProps = instance.propsOptions[0]) &&
                    hasOwn(normalizedProps, key)) {
                    accessCache[key] = 2 /* PROPS */;
                    return props[key];
                }
                else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
                    accessCache[key] = 3 /* CONTEXT */;
                    return ctx[key];
                }
                else if (!__VUE_OPTIONS_API__ || shouldCacheAccess) {
                    accessCache[key] = 4 /* OTHER */;
                }
            }
            const publicGetter = publicPropertiesMap[key];
            let cssModule, globalProperties;
            // public $xxx properties
            if (publicGetter) {
                if (key === '$attrs') {
                    track(instance, "get" /* GET */, key);
                }
                return publicGetter(instance);
            }
            else if (
            // css module (injected by vue-loader)
            (cssModule = type.__cssModules) &&
                (cssModule = cssModule[key])) {
                return cssModule;
            }
            else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
                // user may set custom properties to `this` that start with `$`
                accessCache[key] = 3 /* CONTEXT */;
                return ctx[key];
            }
            else if (
            // global properties
            ((globalProperties = appContext.config.globalProperties),
                hasOwn(globalProperties, key))) {
                {
                    return globalProperties[key];
                }
            }
            else if (currentRenderingInstance &&
                (!isString(key) ||
                    // #1091 avoid internal isRef/isVNode checks on component instance leading
                    // to infinite warning loop
                    key.indexOf('__v') !== 0)) {
                if (data !== EMPTY_OBJ &&
                    (key[0] === '$' || key[0] === '_') &&
                    hasOwn(data, key)) {
                    warn(`Property ${JSON.stringify(key)} must be accessed via $data because it starts with a reserved ` +
                        `character ("$" or "_") and is not proxied on the render context.`);
                }
                else if (instance === currentRenderingInstance) {
                    warn(`Property ${JSON.stringify(key)} was accessed during render ` +
                        `but is not defined on instance.`);
                }
            }
        },
        set({ _: instance }, key, value) {
            const { data, setupState, ctx } = instance;
            if (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) {
                setupState[key] = value;
            }
            else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
                data[key] = value;
            }
            else if (hasOwn(instance.props, key)) {
                warn(`Attempting to mutate prop "${key}". Props are readonly.`, instance);
                return false;
            }
            if (key[0] === '$' && key.slice(1) in instance) {
                warn(`Attempting to mutate public property "${key}". ` +
                        `Properties starting with $ are reserved and readonly.`, instance);
                return false;
            }
            else {
                if (key in instance.appContext.config.globalProperties) {
                    Object.defineProperty(ctx, key, {
                        enumerable: true,
                        configurable: true,
                        value
                    });
                }
                else {
                    ctx[key] = value;
                }
            }
            return true;
        },
        has({ _: { data, setupState, accessCache, ctx, appContext, propsOptions } }, key) {
            let normalizedProps;
            return (accessCache[key] !== undefined ||
                (data !== EMPTY_OBJ && hasOwn(data, key)) ||
                (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) ||
                ((normalizedProps = propsOptions[0]) && hasOwn(normalizedProps, key)) ||
                hasOwn(ctx, key) ||
                hasOwn(publicPropertiesMap, key) ||
                hasOwn(appContext.config.globalProperties, key));
        }
    };
    {
        PublicInstanceProxyHandlers.ownKeys = (target) => {
            warn(`Avoid app logic that relies on enumerating keys on a component instance. ` +
                `The keys will be empty in production mode to avoid performance overhead.`);
            return Reflect.ownKeys(target);
        };
    }
    const RuntimeCompiledPublicInstanceProxyHandlers = extend({}, PublicInstanceProxyHandlers, {
        get(target, key) {
            // fast path for unscopables when using `with` block
            if (key === Symbol.unscopables) {
                return;
            }
            return PublicInstanceProxyHandlers.get(target, key, target);
        },
        has(_, key) {
            const has = key[0] !== '_' && !isGloballyWhitelisted(key);
            if (!has && PublicInstanceProxyHandlers.has(_, key)) {
                warn(`Property ${JSON.stringify(key)} should not start with _ which is a reserved prefix for Vue internals.`);
            }
            return has;
        }
    });
    let currentInstance = null;
    const getCurrentInstance = () => currentInstance || currentRenderingInstance;
    const setCurrentInstance = (instance) => {
        currentInstance = instance;
    };
    const isBuiltInTag = /*#__PURE__*/ makeMap('slot,component');
    function isStatefulComponent(instance) {
        return instance.vnode.shapeFlag & 4 /* STATEFUL_COMPONENT */;
    }
    let isInSSRComponentSetup = false;
    // record effects created during a component's setup() so that they can be
    // stopped when the component unmounts
    function recordInstanceBoundEffect(effect$$1, instance = currentInstance) {
        if (instance) {
            (instance.effects || (instance.effects = [])).push(effect$$1);
        }
    }
    const classifyRE = /(?:^|[-_])(\w)/g;
    const classify = (str) => str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '');
    function getComponentName(Component) {
        return isFunction(Component)
            ? Component.displayName || Component.name
            : Component.name;
    }
    /* istanbul ignore next */
    function formatComponentName(instance, Component, isRoot = false) {
        let name = getComponentName(Component);
        if (!name && Component.__file) {
            const match = Component.__file.match(/([^/\\]+)\.\w+$/);
            if (match) {
                name = match[1];
            }
        }
        if (!name && instance && instance.parent) {
            // try to infer the name based on reverse resolution
            const inferFromRegistry = (registry) => {
                for (const key in registry) {
                    if (registry[key] === Component) {
                        return key;
                    }
                }
            };
            name =
                inferFromRegistry(instance.components ||
                    instance.parent.type.components) || inferFromRegistry(instance.appContext.components);
        }
        return name ? classify(name) : isRoot ? `App` : `Anonymous`;
    }
    function isClassComponent(value) {
        return isFunction(value) && '__vccOpts' in value;
    }

    // Actual implementation
    function h(type, propsOrChildren, children) {
        const l = arguments.length;
        if (l === 2) {
            if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
                // single vnode without props
                if (isVNode(propsOrChildren)) {
                    return createVNode(type, null, [propsOrChildren]);
                }
                // props without children
                return createVNode(type, propsOrChildren);
            }
            else {
                // omit props
                return createVNode(type, null, propsOrChildren);
            }
        }
        else {
            if (l > 3) {
                children = Array.prototype.slice.call(arguments, 2);
            }
            else if (l === 3 && isVNode(children)) {
                children = [children];
            }
            return createVNode(type, propsOrChildren, children);
        }
    }

    function initCustomFormatter() {
        /* eslint-disable no-restricted-globals */
        if (typeof window === 'undefined') {
            return;
        }
        const vueStyle = { style: 'color:#3ba776' };
        const numberStyle = { style: 'color:#0b1bc9' };
        const stringStyle = { style: 'color:#b62e24' };
        const keywordStyle = { style: 'color:#9d288c' };
        // custom formatter for Chrome
        // https://www.mattzeunert.com/2016/02/19/custom-chrome-devtools-object-formatters.html
        const formatter = {
            header(obj) {
                // TODO also format ComponentPublicInstance & ctx.slots/attrs in setup
                if (!isObject(obj)) {
                    return null;
                }
                if (obj.__isVue) {
                    return ['div', vueStyle, `VueInstance`];
                }
                else if (isRef(obj)) {
                    return [
                        'div',
                        {},
                        ['span', vueStyle, genRefFlag(obj)],
                        '<',
                        formatValue(obj.value),
                        `>`
                    ];
                }
                else if (isReactive(obj)) {
                    return [
                        'div',
                        {},
                        ['span', vueStyle, 'Reactive'],
                        '<',
                        formatValue(obj),
                        `>${isReadonly(obj) ? ` (readonly)` : ``}`
                    ];
                }
                else if (isReadonly(obj)) {
                    return [
                        'div',
                        {},
                        ['span', vueStyle, 'Readonly'],
                        '<',
                        formatValue(obj),
                        '>'
                    ];
                }
                return null;
            },
            hasBody(obj) {
                return obj && obj.__isVue;
            },
            body(obj) {
                if (obj && obj.__isVue) {
                    return [
                        'div',
                        {},
                        ...formatInstance(obj.$)
                    ];
                }
            }
        };
        function formatInstance(instance) {
            const blocks = [];
            if (instance.type.props && instance.props) {
                blocks.push(createInstanceBlock('props', toRaw(instance.props)));
            }
            if (instance.setupState !== EMPTY_OBJ) {
                blocks.push(createInstanceBlock('setup', instance.setupState));
            }
            if (instance.data !== EMPTY_OBJ) {
                blocks.push(createInstanceBlock('data', toRaw(instance.data)));
            }
            const computed$$1 = extractKeys(instance, 'computed');
            if (computed$$1) {
                blocks.push(createInstanceBlock('computed', computed$$1));
            }
            const injected = extractKeys(instance, 'inject');
            if (injected) {
                blocks.push(createInstanceBlock('injected', injected));
            }
            blocks.push([
                'div',
                {},
                [
                    'span',
                    {
                        style: keywordStyle.style + ';opacity:0.66'
                    },
                    '$ (internal): '
                ],
                ['object', { object: instance }]
            ]);
            return blocks;
        }
        function createInstanceBlock(type, target) {
            target = extend({}, target);
            if (!Object.keys(target).length) {
                return ['span', {}];
            }
            return [
                'div',
                { style: 'line-height:1.25em;margin-bottom:0.6em' },
                [
                    'div',
                    {
                        style: 'color:#476582'
                    },
                    type
                ],
                [
                    'div',
                    {
                        style: 'padding-left:1.25em'
                    },
                    ...Object.keys(target).map(key => {
                        return [
                            'div',
                            {},
                            ['span', keywordStyle, key + ': '],
                            formatValue(target[key], false)
                        ];
                    })
                ]
            ];
        }
        function formatValue(v, asRaw = true) {
            if (typeof v === 'number') {
                return ['span', numberStyle, v];
            }
            else if (typeof v === 'string') {
                return ['span', stringStyle, JSON.stringify(v)];
            }
            else if (typeof v === 'boolean') {
                return ['span', keywordStyle, v];
            }
            else if (isObject(v)) {
                return ['object', { object: asRaw ? toRaw(v) : v }];
            }
            else {
                return ['span', stringStyle, String(v)];
            }
        }
        function extractKeys(instance, type) {
            const Comp = instance.type;
            if (isFunction(Comp)) {
                return;
            }
            const extracted = {};
            for (const key in instance.ctx) {
                if (isKeyOfType(Comp, key, type)) {
                    extracted[key] = instance.ctx[key];
                }
            }
            return extracted;
        }
        function isKeyOfType(Comp, key, type) {
            const opts = Comp[type];
            if ((isArray(opts) && opts.includes(key)) ||
                (isObject(opts) && key in opts)) {
                return true;
            }
            if (Comp.extends && isKeyOfType(Comp.extends, key, type)) {
                return true;
            }
            if (Comp.mixins && Comp.mixins.some(m => isKeyOfType(m, key, type))) {
                return true;
            }
        }
        function genRefFlag(v) {
            if (v._shallow) {
                return `ShallowRef`;
            }
            if (v.effect) {
                return `ComputedRef`;
            }
            return `Ref`;
        }
        if (window.devtoolsFormatters) {
            window.devtoolsFormatters.push(formatter);
        }
        else {
            window.devtoolsFormatters = [formatter];
        }
    }

    const svgNS = 'http://www.w3.org/2000/svg';
    const doc = (typeof document !== 'undefined' ? document : null);
    let tempContainer;
    let tempSVGContainer;
    const nodeOps = {
        insert: (child, parent, anchor) => {
            parent.insertBefore(child, anchor || null);
        },
        remove: child => {
            const parent = child.parentNode;
            if (parent) {
                parent.removeChild(child);
            }
        },
        createElement: (tag, isSVG, is, props) => {
            const el = isSVG
                ? doc.createElementNS(svgNS, tag)
                : doc.createElement(tag, is ? { is } : undefined);
            if (tag === 'select' && props && props.multiple != null) {
                el.setAttribute('multiple', props.multiple);
            }
            return el;
        },
        createText: text => doc.createTextNode(text),
        createComment: text => doc.createComment(text),
        setText: (node, text) => {
            node.nodeValue = text;
        },
        setElementText: (el, text) => {
            el.textContent = text;
        },
        parentNode: node => node.parentNode,
        nextSibling: node => node.nextSibling,
        querySelector: selector => doc.querySelector(selector),
        setScopeId(el, id) {
            el.setAttribute(id, '');
        },
        cloneNode(el) {
            const cloned = el.cloneNode(true);
            // #3072
            // - in `patchDOMProp`, we store the actual value in the `el._value` property.
            // - normally, elements using `:value` bindings will not be hoisted, but if
            //   the bound value is a constant, e.g. `:value="true"` - they do get
            //   hoisted.
            // - in production, hoisted nodes are cloned when subsequent inserts, but
            //   cloneNode() does not copy the custom property we attached.
            // - This may need to account for other custom DOM properties we attach to
            //   elements in addition to `_value` in the future.
            if (`_value` in el) {
                cloned._value = el._value;
            }
            return cloned;
        },
        // __UNSAFE__
        // Reason: innerHTML.
        // Static content here can only come from compiled templates.
        // As long as the user only uses trusted templates, this is safe.
        insertStaticContent(content, parent, anchor, isSVG) {
            const temp = isSVG
                ? tempSVGContainer ||
                    (tempSVGContainer = doc.createElementNS(svgNS, 'svg'))
                : tempContainer || (tempContainer = doc.createElement('div'));
            temp.innerHTML = content;
            const first = temp.firstChild;
            let node = first;
            let last = node;
            while (node) {
                last = node;
                nodeOps.insert(node, parent, anchor);
                node = temp.firstChild;
            }
            return [first, last];
        }
    };

    // compiler should normalize class + :class bindings on the same element
    // into a single binding ['staticClass', dynamic]
    function patchClass(el, value, isSVG) {
        if (value == null) {
            value = '';
        }
        if (isSVG) {
            el.setAttribute('class', value);
        }
        else {
            // directly setting className should be faster than setAttribute in theory
            // if this is an element during a transition, take the temporary transition
            // classes into account.
            const transitionClasses = el._vtc;
            if (transitionClasses) {
                value = (value
                    ? [value, ...transitionClasses]
                    : [...transitionClasses]).join(' ');
            }
            el.className = value;
        }
    }

    function patchStyle(el, prev, next) {
        const style = el.style;
        if (!next) {
            el.removeAttribute('style');
        }
        else if (isString(next)) {
            if (prev !== next) {
                const current = style.display;
                style.cssText = next;
                // indicates that the `display` of the element is controlled by `v-show`,
                // so we always keep the current `display` value regardless of the `style` value,
                // thus handing over control to `v-show`.
                if ('_vod' in el) {
                    style.display = current;
                }
            }
        }
        else {
            for (const key in next) {
                setStyle(style, key, next[key]);
            }
            if (prev && !isString(prev)) {
                for (const key in prev) {
                    if (next[key] == null) {
                        setStyle(style, key, '');
                    }
                }
            }
        }
    }
    const importantRE = /\s*!important$/;
    function setStyle(style, name, val) {
        if (isArray(val)) {
            val.forEach(v => setStyle(style, name, v));
        }
        else {
            if (name.startsWith('--')) {
                // custom property definition
                style.setProperty(name, val);
            }
            else {
                const prefixed = autoPrefix(style, name);
                if (importantRE.test(val)) {
                    // !important
                    style.setProperty(hyphenate(prefixed), val.replace(importantRE, ''), 'important');
                }
                else {
                    style[prefixed] = val;
                }
            }
        }
    }
    const prefixes = ['Webkit', 'Moz', 'ms'];
    const prefixCache = {};
    function autoPrefix(style, rawName) {
        const cached = prefixCache[rawName];
        if (cached) {
            return cached;
        }
        let name = camelize(rawName);
        if (name !== 'filter' && name in style) {
            return (prefixCache[rawName] = name);
        }
        name = capitalize(name);
        for (let i = 0; i < prefixes.length; i++) {
            const prefixed = prefixes[i] + name;
            if (prefixed in style) {
                return (prefixCache[rawName] = prefixed);
            }
        }
        return rawName;
    }

    const xlinkNS = 'http://www.w3.org/1999/xlink';
    function patchAttr(el, key, value, isSVG, instance) {
        if (isSVG && key.startsWith('xlink:')) {
            if (value == null) {
                el.removeAttributeNS(xlinkNS, key.slice(6, key.length));
            }
            else {
                el.setAttributeNS(xlinkNS, key, value);
            }
        }
        else {
            // note we are only checking boolean attributes that don't have a
            // corresponding dom prop of the same name here.
            const isBoolean = isSpecialBooleanAttr(key);
            if (value == null || (isBoolean && value === false)) {
                el.removeAttribute(key);
            }
            else {
                el.setAttribute(key, isBoolean ? '' : value);
            }
        }
    }

    // __UNSAFE__
    // functions. The user is responsible for using them with only trusted content.
    function patchDOMProp(el, key, value, 
    // the following args are passed only due to potential innerHTML/textContent
    // overriding existing VNodes, in which case the old tree must be properly
    // unmounted.
    prevChildren, parentComponent, parentSuspense, unmountChildren) {
        if (key === 'innerHTML' || key === 'textContent') {
            if (prevChildren) {
                unmountChildren(prevChildren, parentComponent, parentSuspense);
            }
            el[key] = value == null ? '' : value;
            return;
        }
        if (key === 'value' && el.tagName !== 'PROGRESS') {
            // store value as _value as well since
            // non-string values will be stringified.
            el._value = value;
            const newValue = value == null ? '' : value;
            if (el.value !== newValue) {
                el.value = newValue;
            }
            if (value == null) {
                el.removeAttribute(key);
            }
            return;
        }
        if (value === '' || value == null) {
            const type = typeof el[key];
            if (value === '' && type === 'boolean') {
                // e.g. <select multiple> compiles to { multiple: '' }
                el[key] = true;
                return;
            }
            else if (value == null && type === 'string') {
                // e.g. <div :id="null">
                el[key] = '';
                el.removeAttribute(key);
                return;
            }
            else if (type === 'number') {
                // e.g. <img :width="null">
                el[key] = 0;
                el.removeAttribute(key);
                return;
            }
        }
        // some properties perform value validation and throw
        try {
            el[key] = value;
        }
        catch (e) {
            {
                warn(`Failed setting prop "${key}" on <${el.tagName.toLowerCase()}>: ` +
                    `value ${value} is invalid.`, e);
            }
        }
    }

    // Async edge case fix requires storing an event listener's attach timestamp.
    let _getNow = Date.now;
    let skipTimestampCheck = false;
    if (typeof window !== 'undefined') {
        // Determine what event timestamp the browser is using. Annoyingly, the
        // timestamp can either be hi-res (relative to page load) or low-res
        // (relative to UNIX epoch), so in order to compare time we have to use the
        // same timestamp type when saving the flush timestamp.
        if (_getNow() > document.createEvent('Event').timeStamp) {
            // if the low-res timestamp which is bigger than the event timestamp
            // (which is evaluated AFTER) it means the event is using a hi-res timestamp,
            // and we need to use the hi-res version for event listeners as well.
            _getNow = () => performance.now();
        }
        // #3485: Firefox <= 53 has incorrect Event.timeStamp implementation
        // and does not fire microtasks in between event propagation, so safe to exclude.
        const ffMatch = navigator.userAgent.match(/firefox\/(\d+)/i);
        skipTimestampCheck = !!(ffMatch && Number(ffMatch[1]) <= 53);
    }
    // To avoid the overhead of repeatedly calling performance.now(), we cache
    // and use the same timestamp for all event listeners attached in the same tick.
    let cachedNow = 0;
    const p = Promise.resolve();
    const reset = () => {
        cachedNow = 0;
    };
    const getNow = () => cachedNow || (p.then(reset), (cachedNow = _getNow()));
    function addEventListener(el, event, handler, options) {
        el.addEventListener(event, handler, options);
    }
    function removeEventListener(el, event, handler, options) {
        el.removeEventListener(event, handler, options);
    }
    function patchEvent(el, rawName, prevValue, nextValue, instance = null) {
        // vei = vue event invokers
        const invokers = el._vei || (el._vei = {});
        const existingInvoker = invokers[rawName];
        if (nextValue && existingInvoker) {
            // patch
            existingInvoker.value = nextValue;
        }
        else {
            const [name, options] = parseName(rawName);
            if (nextValue) {
                // add
                const invoker = (invokers[rawName] = createInvoker(nextValue, instance));
                addEventListener(el, name, invoker, options);
            }
            else if (existingInvoker) {
                // remove
                removeEventListener(el, name, existingInvoker, options);
                invokers[rawName] = undefined;
            }
        }
    }
    const optionsModifierRE = /(?:Once|Passive|Capture)$/;
    function parseName(name) {
        let options;
        if (optionsModifierRE.test(name)) {
            options = {};
            let m;
            while ((m = name.match(optionsModifierRE))) {
                name = name.slice(0, name.length - m[0].length);
                options[m[0].toLowerCase()] = true;
            }
        }
        return [hyphenate(name.slice(2)), options];
    }
    function createInvoker(initialValue, instance) {
        const invoker = (e) => {
            // async edge case #6566: inner click event triggers patch, event handler
            // attached to outer element during patch, and triggered again. This
            // happens because browsers fire microtask ticks between event propagation.
            // the solution is simple: we save the timestamp when a handler is attached,
            // and the handler would only fire if the event passed to it was fired
            // AFTER it was attached.
            const timeStamp = e.timeStamp || _getNow();
            if (skipTimestampCheck || timeStamp >= invoker.attached - 1) {
                callWithAsyncErrorHandling(patchStopImmediatePropagation(e, invoker.value), instance, 5 /* NATIVE_EVENT_HANDLER */, [e]);
            }
        };
        invoker.value = initialValue;
        invoker.attached = getNow();
        return invoker;
    }
    function patchStopImmediatePropagation(e, value) {
        if (isArray(value)) {
            const originalStop = e.stopImmediatePropagation;
            e.stopImmediatePropagation = () => {
                originalStop.call(e);
                e._stopped = true;
            };
            return value.map(fn => (e) => !e._stopped && fn(e));
        }
        else {
            return value;
        }
    }

    const nativeOnRE = /^on[a-z]/;
    const forcePatchProp = (_, key) => key === 'value';
    const patchProp = (el, key, prevValue, nextValue, isSVG = false, prevChildren, parentComponent, parentSuspense, unmountChildren) => {
        switch (key) {
            // special
            case 'class':
                patchClass(el, nextValue, isSVG);
                break;
            case 'style':
                patchStyle(el, prevValue, nextValue);
                break;
            default:
                if (isOn(key)) {
                    // ignore v-model listeners
                    if (!isModelListener(key)) {
                        patchEvent(el, key, prevValue, nextValue, parentComponent);
                    }
                }
                else if (shouldSetAsProp(el, key, nextValue, isSVG)) {
                    patchDOMProp(el, key, nextValue, prevChildren, parentComponent, parentSuspense, unmountChildren);
                }
                else {
                    // special case for <input v-model type="checkbox"> with
                    // :true-value & :false-value
                    // store value as dom properties since non-string values will be
                    // stringified.
                    if (key === 'true-value') {
                        el._trueValue = nextValue;
                    }
                    else if (key === 'false-value') {
                        el._falseValue = nextValue;
                    }
                    patchAttr(el, key, nextValue, isSVG);
                }
                break;
        }
    };
    function shouldSetAsProp(el, key, value, isSVG) {
        if (isSVG) {
            // most keys must be set as attribute on svg elements to work
            // ...except innerHTML
            if (key === 'innerHTML') {
                return true;
            }
            // or native onclick with function values
            if (key in el && nativeOnRE.test(key) && isFunction(value)) {
                return true;
            }
            return false;
        }
        // spellcheck and draggable are numerated attrs, however their
        // corresponding DOM properties are actually booleans - this leads to
        // setting it with a string "false" value leading it to be coerced to
        // `true`, so we need to always treat them as attributes.
        // Note that `contentEditable` doesn't have this problem: its DOM
        // property is also enumerated string values.
        if (key === 'spellcheck' || key === 'draggable') {
            return false;
        }
        // #1787, #2840 form property on form elements is readonly and must be set as
        // attribute.
        if (key === 'form') {
            return false;
        }
        // #1526 <input list> must be set as attribute
        if (key === 'list' && el.tagName === 'INPUT') {
            return false;
        }
        // #2766 <textarea type> must be set as attribute
        if (key === 'type' && el.tagName === 'TEXTAREA') {
            return false;
        }
        // native onclick with string value, must be set as attribute
        if (nativeOnRE.test(key) && isString(value)) {
            return false;
        }
        return key in el;
    }

    const TRANSITION = 'transition';
    const ANIMATION = 'animation';
    // DOM Transition is a higher-order-component based on the platform-agnostic
    // base Transition component, with DOM-specific logic.
    const Transition = (props, { slots }) => h(BaseTransition, resolveTransitionProps(props), slots);
    Transition.displayName = 'Transition';
    const DOMTransitionPropsValidators = {
        name: String,
        type: String,
        css: {
            type: Boolean,
            default: true
        },
        duration: [String, Number, Object],
        enterFromClass: String,
        enterActiveClass: String,
        enterToClass: String,
        appearFromClass: String,
        appearActiveClass: String,
        appearToClass: String,
        leaveFromClass: String,
        leaveActiveClass: String,
        leaveToClass: String
    };
    const TransitionPropsValidators = (Transition.props = /*#__PURE__*/ extend({}, BaseTransition.props, DOMTransitionPropsValidators));
    /**
     * #3227 Incoming hooks may be merged into arrays when wrapping Transition
     * with custom HOCs.
     */
    const callHook$1 = (hook, args = []) => {
        if (isArray(hook)) {
            hook.forEach(h$$1 => h$$1(...args));
        }
        else if (hook) {
            hook(...args);
        }
    };
    /**
     * Check if a hook expects a callback (2nd arg), which means the user
     * intends to explicitly control the end of the transition.
     */
    const hasExplicitCallback = (hook) => {
        return hook
            ? isArray(hook)
                ? hook.some(h$$1 => h$$1.length > 1)
                : hook.length > 1
            : false;
    };
    function resolveTransitionProps(rawProps) {
        const baseProps = {};
        for (const key in rawProps) {
            if (!(key in DOMTransitionPropsValidators)) {
                baseProps[key] = rawProps[key];
            }
        }
        if (rawProps.css === false) {
            return baseProps;
        }
        const { name = 'v', type, duration, enterFromClass = `${name}-enter-from`, enterActiveClass = `${name}-enter-active`, enterToClass = `${name}-enter-to`, appearFromClass = enterFromClass, appearActiveClass = enterActiveClass, appearToClass = enterToClass, leaveFromClass = `${name}-leave-from`, leaveActiveClass = `${name}-leave-active`, leaveToClass = `${name}-leave-to` } = rawProps;
        const durations = normalizeDuration(duration);
        const enterDuration = durations && durations[0];
        const leaveDuration = durations && durations[1];
        const { onBeforeEnter, onEnter, onEnterCancelled, onLeave, onLeaveCancelled, onBeforeAppear = onBeforeEnter, onAppear = onEnter, onAppearCancelled = onEnterCancelled } = baseProps;
        const finishEnter = (el, isAppear, done) => {
            removeTransitionClass(el, isAppear ? appearToClass : enterToClass);
            removeTransitionClass(el, isAppear ? appearActiveClass : enterActiveClass);
            done && done();
        };
        const finishLeave = (el, done) => {
            removeTransitionClass(el, leaveToClass);
            removeTransitionClass(el, leaveActiveClass);
            done && done();
        };
        const makeEnterHook = (isAppear) => {
            return (el, done) => {
                const hook = isAppear ? onAppear : onEnter;
                const resolve = () => finishEnter(el, isAppear, done);
                callHook$1(hook, [el, resolve]);
                nextFrame(() => {
                    removeTransitionClass(el, isAppear ? appearFromClass : enterFromClass);
                    addTransitionClass(el, isAppear ? appearToClass : enterToClass);
                    if (!hasExplicitCallback(hook)) {
                        whenTransitionEnds(el, type, enterDuration, resolve);
                    }
                });
            };
        };
        return extend(baseProps, {
            onBeforeEnter(el) {
                callHook$1(onBeforeEnter, [el]);
                addTransitionClass(el, enterFromClass);
                addTransitionClass(el, enterActiveClass);
            },
            onBeforeAppear(el) {
                callHook$1(onBeforeAppear, [el]);
                addTransitionClass(el, appearFromClass);
                addTransitionClass(el, appearActiveClass);
            },
            onEnter: makeEnterHook(false),
            onAppear: makeEnterHook(true),
            onLeave(el, done) {
                const resolve = () => finishLeave(el, done);
                addTransitionClass(el, leaveFromClass);
                // force reflow so *-leave-from classes immediately take effect (#2593)
                forceReflow();
                addTransitionClass(el, leaveActiveClass);
                nextFrame(() => {
                    removeTransitionClass(el, leaveFromClass);
                    addTransitionClass(el, leaveToClass);
                    if (!hasExplicitCallback(onLeave)) {
                        whenTransitionEnds(el, type, leaveDuration, resolve);
                    }
                });
                callHook$1(onLeave, [el, resolve]);
            },
            onEnterCancelled(el) {
                finishEnter(el, false);
                callHook$1(onEnterCancelled, [el]);
            },
            onAppearCancelled(el) {
                finishEnter(el, true);
                callHook$1(onAppearCancelled, [el]);
            },
            onLeaveCancelled(el) {
                finishLeave(el);
                callHook$1(onLeaveCancelled, [el]);
            }
        });
    }
    function normalizeDuration(duration) {
        if (duration == null) {
            return null;
        }
        else if (isObject(duration)) {
            return [NumberOf(duration.enter), NumberOf(duration.leave)];
        }
        else {
            const n = NumberOf(duration);
            return [n, n];
        }
    }
    function NumberOf(val) {
        const res = toNumber(val);
        validateDuration(res);
        return res;
    }
    function validateDuration(val) {
        if (typeof val !== 'number') {
            warn(`<transition> explicit duration is not a valid number - ` +
                `got ${JSON.stringify(val)}.`);
        }
        else if (isNaN(val)) {
            warn(`<transition> explicit duration is NaN - ` +
                'the duration expression might be incorrect.');
        }
    }
    function addTransitionClass(el, cls) {
        cls.split(/\s+/).forEach(c => c && el.classList.add(c));
        (el._vtc ||
            (el._vtc = new Set())).add(cls);
    }
    function removeTransitionClass(el, cls) {
        cls.split(/\s+/).forEach(c => c && el.classList.remove(c));
        const { _vtc } = el;
        if (_vtc) {
            _vtc.delete(cls);
            if (!_vtc.size) {
                el._vtc = undefined;
            }
        }
    }
    function nextFrame(cb) {
        requestAnimationFrame(() => {
            requestAnimationFrame(cb);
        });
    }
    let endId = 0;
    function whenTransitionEnds(el, expectedType, explicitTimeout, resolve) {
        const id = (el._endId = ++endId);
        const resolveIfNotStale = () => {
            if (id === el._endId) {
                resolve();
            }
        };
        if (explicitTimeout) {
            return setTimeout(resolveIfNotStale, explicitTimeout);
        }
        const { type, timeout, propCount } = getTransitionInfo(el, expectedType);
        if (!type) {
            return resolve();
        }
        const endEvent = type + 'end';
        let ended = 0;
        const end = () => {
            el.removeEventListener(endEvent, onEnd);
            resolveIfNotStale();
        };
        const onEnd = (e) => {
            if (e.target === el && ++ended >= propCount) {
                end();
            }
        };
        setTimeout(() => {
            if (ended < propCount) {
                end();
            }
        }, timeout + 1);
        el.addEventListener(endEvent, onEnd);
    }
    function getTransitionInfo(el, expectedType) {
        const styles = window.getComputedStyle(el);
        // JSDOM may return undefined for transition properties
        const getStyleProperties = (key) => (styles[key] || '').split(', ');
        const transitionDelays = getStyleProperties(TRANSITION + 'Delay');
        const transitionDurations = getStyleProperties(TRANSITION + 'Duration');
        const transitionTimeout = getTimeout(transitionDelays, transitionDurations);
        const animationDelays = getStyleProperties(ANIMATION + 'Delay');
        const animationDurations = getStyleProperties(ANIMATION + 'Duration');
        const animationTimeout = getTimeout(animationDelays, animationDurations);
        let type = null;
        let timeout = 0;
        let propCount = 0;
        /* istanbul ignore if */
        if (expectedType === TRANSITION) {
            if (transitionTimeout > 0) {
                type = TRANSITION;
                timeout = transitionTimeout;
                propCount = transitionDurations.length;
            }
        }
        else if (expectedType === ANIMATION) {
            if (animationTimeout > 0) {
                type = ANIMATION;
                timeout = animationTimeout;
                propCount = animationDurations.length;
            }
        }
        else {
            timeout = Math.max(transitionTimeout, animationTimeout);
            type =
                timeout > 0
                    ? transitionTimeout > animationTimeout
                        ? TRANSITION
                        : ANIMATION
                    : null;
            propCount = type
                ? type === TRANSITION
                    ? transitionDurations.length
                    : animationDurations.length
                : 0;
        }
        const hasTransform = type === TRANSITION &&
            /\b(transform|all)(,|$)/.test(styles[TRANSITION + 'Property']);
        return {
            type,
            timeout,
            propCount,
            hasTransform
        };
    }
    function getTimeout(delays, durations) {
        while (delays.length < durations.length) {
            delays = delays.concat(delays);
        }
        return Math.max(...durations.map((d, i) => toMs(d) + toMs(delays[i])));
    }
    // Old versions of Chromium (below 61.0.3163.100) formats floating pointer
    // numbers in a locale-dependent way, using a comma instead of a dot.
    // If comma is not replaced with a dot, the input will be rounded down
    // (i.e. acting as a floor function) causing unexpected behaviors
    function toMs(s) {
        return Number(s.slice(0, -1).replace(',', '.')) * 1000;
    }
    // synchronously force layout to put elements into a certain state
    function forceReflow() {
        return document.body.offsetHeight;
    }

    const positionMap = new WeakMap();
    const newPositionMap = new WeakMap();
    const TransitionGroupImpl = {
        name: 'TransitionGroup',
        props: /*#__PURE__*/ extend({}, TransitionPropsValidators, {
            tag: String,
            moveClass: String
        }),
        setup(props, { slots }) {
            const instance = getCurrentInstance();
            const state = useTransitionState();
            let prevChildren;
            let children;
            onUpdated(() => {
                // children is guaranteed to exist after initial render
                if (!prevChildren.length) {
                    return;
                }
                const moveClass = props.moveClass || `${props.name || 'v'}-move`;
                if (!hasCSSTransform(prevChildren[0].el, instance.vnode.el, moveClass)) {
                    return;
                }
                // we divide the work into three loops to avoid mixing DOM reads and writes
                // in each iteration - which helps prevent layout thrashing.
                prevChildren.forEach(callPendingCbs);
                prevChildren.forEach(recordPosition);
                const movedChildren = prevChildren.filter(applyTranslation);
                // force reflow to put everything in position
                forceReflow();
                movedChildren.forEach(c => {
                    const el = c.el;
                    const style = el.style;
                    addTransitionClass(el, moveClass);
                    style.transform = style.webkitTransform = style.transitionDuration = '';
                    const cb = (el._moveCb = (e) => {
                        if (e && e.target !== el) {
                            return;
                        }
                        if (!e || /transform$/.test(e.propertyName)) {
                            el.removeEventListener('transitionend', cb);
                            el._moveCb = null;
                            removeTransitionClass(el, moveClass);
                        }
                    });
                    el.addEventListener('transitionend', cb);
                });
            });
            return () => {
                const rawProps = toRaw(props);
                const cssTransitionProps = resolveTransitionProps(rawProps);
                let tag = rawProps.tag || Fragment;
                prevChildren = children;
                children = slots.default ? getTransitionRawChildren(slots.default()) : [];
                for (let i = 0; i < children.length; i++) {
                    const child = children[i];
                    if (child.key != null) {
                        setTransitionHooks(child, resolveTransitionHooks(child, cssTransitionProps, state, instance));
                    }
                    else {
                        warn(`<TransitionGroup> children must be keyed.`);
                    }
                }
                if (prevChildren) {
                    for (let i = 0; i < prevChildren.length; i++) {
                        const child = prevChildren[i];
                        setTransitionHooks(child, resolveTransitionHooks(child, cssTransitionProps, state, instance));
                        positionMap.set(child, child.el.getBoundingClientRect());
                    }
                }
                return createVNode(tag, null, children);
            };
        }
    };
    function callPendingCbs(c) {
        const el = c.el;
        if (el._moveCb) {
            el._moveCb();
        }
        if (el._enterCb) {
            el._enterCb();
        }
    }
    function recordPosition(c) {
        newPositionMap.set(c, c.el.getBoundingClientRect());
    }
    function applyTranslation(c) {
        const oldPos = positionMap.get(c);
        const newPos = newPositionMap.get(c);
        const dx = oldPos.left - newPos.left;
        const dy = oldPos.top - newPos.top;
        if (dx || dy) {
            const s = c.el.style;
            s.transform = s.webkitTransform = `translate(${dx}px,${dy}px)`;
            s.transitionDuration = '0s';
            return c;
        }
    }
    function hasCSSTransform(el, root, moveClass) {
        // Detect whether an element with the move class applied has
        // CSS transitions. Since the element may be inside an entering
        // transition at this very moment, we make a clone of it and remove
        // all other transition classes applied to ensure only the move class
        // is applied.
        const clone = el.cloneNode();
        if (el._vtc) {
            el._vtc.forEach(cls => {
                cls.split(/\s+/).forEach(c => c && clone.classList.remove(c));
            });
        }
        moveClass.split(/\s+/).forEach(c => c && clone.classList.add(c));
        clone.style.display = 'none';
        const container = (root.nodeType === 1
            ? root
            : root.parentNode);
        container.appendChild(clone);
        const { hasTransform } = getTransitionInfo(clone);
        container.removeChild(clone);
        return hasTransform;
    }

    const rendererOptions = extend({ patchProp, forcePatchProp }, nodeOps);

    function initDev() {
        {
            initCustomFormatter();
        }
    }

    // This entry exports the runtime only, and is built as
    {
        initDev();
    }

    var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var croppie = createCommonjsModule(function (module, exports) {
    /*************************
     * Croppie
     * Copyright 2019
     * Foliotek
     * Version: 2.6.4
     *************************/
    (function (root, factory) {
        if (typeof exports.nodeName !== 'string') {
            // CommonJS
            module.exports = factory();
        } else {
            // Browser globals
            root.Croppie = factory();
        }
    }(typeof self !== 'undefined' ? self : commonjsGlobal, function () {

        /* Polyfills */
        if (typeof Promise !== 'function') {
            /*! promise-polyfill 3.1.0 */
            !function(a){function b(a,b){return function(){a.apply(b,arguments);}}function c(a){if("object"!==typeof this)throw new TypeError("Promises must be constructed via new");if("function"!==typeof a)throw new TypeError("not a function");this._state=null,this._value=null,this._deferreds=[],i(a,b(e,this),b(f,this));}function d(a){var b=this;return null===this._state?void this._deferreds.push(a):void k(function(){var c=b._state?a.onFulfilled:a.onRejected;if(null===c)return void(b._state?a.resolve:a.reject)(b._value);var d;try{d=c(b._value);}catch(e){return void a.reject(e)}a.resolve(d);})}function e(a){try{if(a===this)throw new TypeError("A promise cannot be resolved with itself.");if(a&&("object"===typeof a||"function"===typeof a)){var c=a.then;if("function"===typeof c)return void i(b(c,a),b(e,this),b(f,this))}this._state=!0,this._value=a,g.call(this);}catch(d){f.call(this,d);}}function f(a){this._state=!1,this._value=a,g.call(this);}function g(){for(var a=0,b=this._deferreds.length;b>a;a++)d.call(this,this._deferreds[a]);this._deferreds=null;}function h(a,b,c,d){this.onFulfilled="function"===typeof a?a:null,this.onRejected="function"===typeof b?b:null,this.resolve=c,this.reject=d;}function i(a,b,c){var d=!1;try{a(function(a){d||(d=!0,b(a));},function(a){d||(d=!0,c(a));});}catch(e){if(d)return;d=!0,c(e);}}var j=setTimeout,k="function"===typeof setImmediate&&setImmediate||function(a){j(a,1);},l=Array.isArray||function(a){return "[object Array]"===Object.prototype.toString.call(a)};c.prototype["catch"]=function(a){return this.then(null,a)},c.prototype.then=function(a,b){var e=this;return new c(function(c,f){d.call(e,new h(a,b,c,f));})},c.all=function(){var a=Array.prototype.slice.call(1===arguments.length&&l(arguments[0])?arguments[0]:arguments);return new c(function(b,c){function d(f,g){try{if(g&&("object"===typeof g||"function"===typeof g)){var h=g.then;if("function"===typeof h)return void h.call(g,function(a){d(f,a);},c)}a[f]=g,0===--e&&b(a);}catch(i){c(i);}}if(0===a.length)return b([]);for(var e=a.length,f=0;f<a.length;f++)d(f,a[f]);})},c.resolve=function(a){return a&&"object"===typeof a&&a.constructor===c?a:new c(function(b){b(a);})},c.reject=function(a){return new c(function(b,c){c(a);})},c.race=function(a){return new c(function(b,c){for(var d=0,e=a.length;e>d;d++)a[d].then(b,c);})},c._setImmediateFn=function(a){k=a;},module.exports?module.exports=c:a.Promise||(a.Promise=c);}(this);
        }

        if ( typeof window.CustomEvent !== "function" ) {
            (function(){
                function CustomEvent ( event, params ) {
                    params = params || { bubbles: false, cancelable: false, detail: undefined };
                    var evt = document.createEvent( 'CustomEvent' );
                    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
                    return evt;
                }
                CustomEvent.prototype = window.Event.prototype;
                window.CustomEvent = CustomEvent;
            }());
        }

        if (!HTMLCanvasElement.prototype.toBlob) {
            Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
                value: function (callback, type, quality) {
                    var binStr = atob( this.toDataURL(type, quality).split(',')[1] ),
                    len = binStr.length,
                    arr = new Uint8Array(len);

                    for (var i=0; i<len; i++ ) {
                        arr[i] = binStr.charCodeAt(i);
                    }

                    callback( new Blob( [arr], {type: type || 'image/png'} ) );
                }
            });
        }
        /* End Polyfills */

        var cssPrefixes = ['Webkit', 'Moz', 'ms'],
            emptyStyles = document.createElement('div').style,
            EXIF_NORM = [1,8,3,6],
            EXIF_FLIP = [2,7,4,5],
            CSS_TRANS_ORG,
            CSS_TRANSFORM,
            CSS_USERSELECT;

        function vendorPrefix(prop) {
            if (prop in emptyStyles) {
                return prop;
            }

            var capProp = prop[0].toUpperCase() + prop.slice(1),
                i = cssPrefixes.length;

            while (i--) {
                prop = cssPrefixes[i] + capProp;
                if (prop in emptyStyles) {
                    return prop;
                }
            }
        }

        CSS_TRANSFORM = vendorPrefix('transform');
        CSS_TRANS_ORG = vendorPrefix('transformOrigin');
        CSS_USERSELECT = vendorPrefix('userSelect');

        function getExifOffset(ornt, rotate) {
            var arr = EXIF_NORM.indexOf(ornt) > -1 ? EXIF_NORM : EXIF_FLIP,
                index = arr.indexOf(ornt),
                offset = (rotate / 90) % arr.length;// 180 = 2%4 = 2 shift exif by 2 indexes

            return arr[(arr.length + index + (offset % arr.length)) % arr.length];
        }

        // Credits to : Andrew Dupont - http://andrewdupont.net/2009/08/28/deep-extending-objects-in-javascript/
        function deepExtend(destination, source) {
            destination = destination || {};
            for (var property in source) {
                if (source[property] && source[property].constructor && source[property].constructor === Object) {
                    destination[property] = destination[property] || {};
                    deepExtend(destination[property], source[property]);
                } else {
                    destination[property] = source[property];
                }
            }
            return destination;
        }

        function clone(object) {
            return deepExtend({}, object);
        }

        function debounce(func, wait, immediate) {
            var timeout;
            return function () {
                var context = this, args = arguments;
                var later = function () {
                    timeout = null;
                    if (!immediate) func.apply(context, args);
                };
                var callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) func.apply(context, args);
            };
        }

        function dispatchChange(element) {
            if ("createEvent" in document) {
                var evt = document.createEvent("HTMLEvents");
                evt.initEvent("change", false, true);
                element.dispatchEvent(evt);
            }
            else {
                element.fireEvent("onchange");
            }
        }

        //http://jsperf.com/vanilla-css
        function css(el, styles, val) {
            if (typeof (styles) === 'string') {
                var tmp = styles;
                styles = {};
                styles[tmp] = val;
            }

            for (var prop in styles) {
                el.style[prop] = styles[prop];
            }
        }

        function addClass(el, c) {
            if (el.classList) {
                el.classList.add(c);
            }
            else {
                el.className += ' ' + c;
            }
        }

        function removeClass(el, c) {
            if (el.classList) {
                el.classList.remove(c);
            }
            else {
                el.className = el.className.replace(c, '');
            }
        }

        function setAttributes(el, attrs) {
            for (var key in attrs) {
                el.setAttribute(key, attrs[key]);
            }
        }

        function num(v) {
            return parseInt(v, 10);
        }

        /* Utilities */
        function loadImage(src, doExif) {
            var img = new Image();
            img.style.opacity = '0';
            return new Promise(function (resolve, reject) {
                function _resolve() {
                    img.style.opacity = '1';
                    setTimeout(function () {
                        resolve(img);
                    }, 1);
                }

                img.removeAttribute('crossOrigin');
                if (src.match(/^https?:\/\/|^\/\//)) {
                    img.setAttribute('crossOrigin', 'anonymous');
                }

                img.onload = function () {
                    if (doExif) {
                        EXIF.getData(img, function () {
                            _resolve();
                        });
                    }
                    else {
                        _resolve();
                    }
                };
                img.onerror = function (ev) {
                    img.style.opacity = 1;
                    setTimeout(function () {
                        reject(ev);
                    }, 1);
                };
                img.src = src;
            });
        }

        function naturalImageDimensions(img, ornt) {
            var w = img.naturalWidth;
            var h = img.naturalHeight;
            var orient = ornt || getExifOrientation(img);
            if (orient && orient >= 5) {
                var x= w;
                w = h;
                h = x;
            }
            return { width: w, height: h };
        }

        /* CSS Transform Prototype */
        var TRANSLATE_OPTS = {
            'translate3d': {
                suffix: ', 0px'
            },
            'translate': {
                suffix: ''
            }
        };
        var Transform = function (x, y, scale) {
            this.x = parseFloat(x);
            this.y = parseFloat(y);
            this.scale = parseFloat(scale);
        };

        Transform.parse = function (v) {
            if (v.style) {
                return Transform.parse(v.style[CSS_TRANSFORM]);
            }
            else if (v.indexOf('matrix') > -1 || v.indexOf('none') > -1) {
                return Transform.fromMatrix(v);
            }
            else {
                return Transform.fromString(v);
            }
        };

        Transform.fromMatrix = function (v) {
            var vals = v.substring(7).split(',');
            if (!vals.length || v === 'none') {
                vals = [1, 0, 0, 1, 0, 0];
            }

            return new Transform(num(vals[4]), num(vals[5]), parseFloat(vals[0]));
        };

        Transform.fromString = function (v) {
            var values = v.split(') '),
                translate = values[0].substring(Croppie.globals.translate.length + 1).split(','),
                scale = values.length > 1 ? values[1].substring(6) : 1,
                x = translate.length > 1 ? translate[0] : 0,
                y = translate.length > 1 ? translate[1] : 0;

            return new Transform(x, y, scale);
        };

        Transform.prototype.toString = function () {
            var suffix = TRANSLATE_OPTS[Croppie.globals.translate].suffix || '';
            return Croppie.globals.translate + '(' + this.x + 'px, ' + this.y + 'px' + suffix + ') scale(' + this.scale + ')';
        };

        var TransformOrigin = function (el) {
            if (!el || !el.style[CSS_TRANS_ORG]) {
                this.x = 0;
                this.y = 0;
                return;
            }
            var css = el.style[CSS_TRANS_ORG].split(' ');
            this.x = parseFloat(css[0]);
            this.y = parseFloat(css[1]);
        };

        TransformOrigin.prototype.toString = function () {
            return this.x + 'px ' + this.y + 'px';
        };

        function getExifOrientation (img) {
            return img.exifdata && img.exifdata.Orientation ? num(img.exifdata.Orientation) : 1;
        }

        function drawCanvas(canvas, img, orientation) {
            var width = img.width,
                height = img.height,
                ctx = canvas.getContext('2d');

            canvas.width = img.width;
            canvas.height = img.height;

            ctx.save();
            switch (orientation) {
              case 2:
                 ctx.translate(width, 0);
                 ctx.scale(-1, 1);
                 break;

              case 3:
                  ctx.translate(width, height);
                  ctx.rotate(180*Math.PI/180);
                  break;

              case 4:
                  ctx.translate(0, height);
                  ctx.scale(1, -1);
                  break;

              case 5:
                  canvas.width = height;
                  canvas.height = width;
                  ctx.rotate(90*Math.PI/180);
                  ctx.scale(1, -1);
                  break;

              case 6:
                  canvas.width = height;
                  canvas.height = width;
                  ctx.rotate(90*Math.PI/180);
                  ctx.translate(0, -height);
                  break;

              case 7:
                  canvas.width = height;
                  canvas.height = width;
                  ctx.rotate(-90*Math.PI/180);
                  ctx.translate(-width, height);
                  ctx.scale(1, -1);
                  break;

              case 8:
                  canvas.width = height;
                  canvas.height = width;
                  ctx.translate(0, width);
                  ctx.rotate(-90*Math.PI/180);
                  break;
            }
            ctx.drawImage(img, 0,0, width, height);
            ctx.restore();
        }

        /* Private Methods */
        function _create() {
            var self = this,
                contClass = 'croppie-container',
                customViewportClass = self.options.viewport.type ? 'cr-vp-' + self.options.viewport.type : null,
                boundary, img, viewport, overlay, bw, bh;

            self.options.useCanvas = self.options.enableOrientation || _hasExif.call(self);
            // Properties on class
            self.data = {};
            self.elements = {};

            boundary = self.elements.boundary = document.createElement('div');
            viewport = self.elements.viewport = document.createElement('div');
            img = self.elements.img = document.createElement('img');
            overlay = self.elements.overlay = document.createElement('div');

            if (self.options.useCanvas) {
                self.elements.canvas = document.createElement('canvas');
                self.elements.preview = self.elements.canvas;
            }
            else {
                self.elements.preview = img;
            }

            addClass(boundary, 'cr-boundary');
            boundary.setAttribute('aria-dropeffect', 'none');
            bw = self.options.boundary.width;
            bh = self.options.boundary.height;
            css(boundary, {
                width: (bw + (isNaN(bw) ? '' : 'px')),
                height: (bh + (isNaN(bh) ? '' : 'px'))
            });

            addClass(viewport, 'cr-viewport');
            if (customViewportClass) {
                addClass(viewport, customViewportClass);
            }
            css(viewport, {
                width: self.options.viewport.width + 'px',
                height: self.options.viewport.height + 'px'
            });
            viewport.setAttribute('tabindex', 0);

            addClass(self.elements.preview, 'cr-image');
            setAttributes(self.elements.preview, { 'alt': 'preview', 'aria-grabbed': 'false' });
            addClass(overlay, 'cr-overlay');

            self.element.appendChild(boundary);
            boundary.appendChild(self.elements.preview);
            boundary.appendChild(viewport);
            boundary.appendChild(overlay);

            addClass(self.element, contClass);
            if (self.options.customClass) {
                addClass(self.element, self.options.customClass);
            }

            _initDraggable.call(this);

            if (self.options.enableZoom) {
                _initializeZoom.call(self);
            }

            // if (self.options.enableOrientation) {
            //     _initRotationControls.call(self);
            // }

            if (self.options.enableResize) {
                _initializeResize.call(self);
            }
        }

        // function _initRotationControls () {
        //     var self = this,
        //         wrap, btnLeft, btnRight, iLeft, iRight;

        //     wrap = document.createElement('div');
        //     self.elements.orientationBtnLeft = btnLeft = document.createElement('button');
        //     self.elements.orientationBtnRight = btnRight = document.createElement('button');

        //     wrap.appendChild(btnLeft);
        //     wrap.appendChild(btnRight);

        //     iLeft = document.createElement('i');
        //     iRight = document.createElement('i');
        //     btnLeft.appendChild(iLeft);
        //     btnRight.appendChild(iRight);

        //     addClass(wrap, 'cr-rotate-controls');
        //     addClass(btnLeft, 'cr-rotate-l');
        //     addClass(btnRight, 'cr-rotate-r');

        //     self.elements.boundary.appendChild(wrap);

        //     btnLeft.addEventListener('click', function () {
        //         self.rotate(-90);
        //     });
        //     btnRight.addEventListener('click', function () {
        //         self.rotate(90);
        //     });
        // }

        function _hasExif() {
            return this.options.enableExif && window.EXIF;
        }

        function _initializeResize () {
            var self = this;
            var wrap = document.createElement('div');
            var isDragging = false;
            var direction;
            var originalX;
            var originalY;
            var minSize = 50;
            var maxWidth;
            var maxHeight;
            var vr;
            var hr;

            addClass(wrap, 'cr-resizer');
            css(wrap, {
                width: this.options.viewport.width + 'px',
                height: this.options.viewport.height + 'px'
            });

            if (this.options.resizeControls.height) {
                vr = document.createElement('div');
                addClass(vr, 'cr-resizer-vertical');
                wrap.appendChild(vr);
            }

            if (this.options.resizeControls.width) {
                hr = document.createElement('div');
                addClass(hr, 'cr-resizer-horisontal');
                wrap.appendChild(hr);
            }

            function mouseDown(ev) {
                if (ev.button !== undefined && ev.button !== 0) return;

                ev.preventDefault();
                if (isDragging) {
                    return;
                }

                var overlayRect = self.elements.overlay.getBoundingClientRect();

                isDragging = true;
                originalX = ev.pageX;
                originalY = ev.pageY;
                direction = ev.currentTarget.className.indexOf('vertical') !== -1 ? 'v' : 'h';
                maxWidth = overlayRect.width;
                maxHeight = overlayRect.height;

                if (ev.touches) {
                    var touches = ev.touches[0];
                    originalX = touches.pageX;
                    originalY = touches.pageY;
                }

                window.addEventListener('mousemove', mouseMove);
                window.addEventListener('touchmove', mouseMove);
                window.addEventListener('mouseup', mouseUp);
                window.addEventListener('touchend', mouseUp);
                document.body.style[CSS_USERSELECT] = 'none';
            }

            function mouseMove(ev) {
                var pageX = ev.pageX;
                var pageY = ev.pageY;

                ev.preventDefault();

                if (ev.touches) {
                    var touches = ev.touches[0];
                    pageX = touches.pageX;
                    pageY = touches.pageY;
                }

                var deltaX = pageX - originalX;
                var deltaY = pageY - originalY;
                var newHeight = self.options.viewport.height + deltaY;
                var newWidth = self.options.viewport.width + deltaX;

                if (direction === 'v' && newHeight >= minSize && newHeight <= maxHeight) {
                    css(wrap, {
                        height: newHeight + 'px'
                    });

                    self.options.boundary.height += deltaY;
                    css(self.elements.boundary, {
                        height: self.options.boundary.height + 'px'
                    });

                    self.options.viewport.height += deltaY;
                    css(self.elements.viewport, {
                        height: self.options.viewport.height + 'px'
                    });
                }
                else if (direction === 'h' && newWidth >= minSize && newWidth <= maxWidth) {
                    css(wrap, {
                        width: newWidth + 'px'
                    });

                    self.options.boundary.width += deltaX;
                    css(self.elements.boundary, {
                        width: self.options.boundary.width + 'px'
                    });

                    self.options.viewport.width += deltaX;
                    css(self.elements.viewport, {
                        width: self.options.viewport.width + 'px'
                    });
                }

                _updateOverlay.call(self);
                _updateZoomLimits.call(self);
                _updateCenterPoint.call(self);
                _triggerUpdate.call(self);
                originalY = pageY;
                originalX = pageX;
            }

            function mouseUp() {
                isDragging = false;
                window.removeEventListener('mousemove', mouseMove);
                window.removeEventListener('touchmove', mouseMove);
                window.removeEventListener('mouseup', mouseUp);
                window.removeEventListener('touchend', mouseUp);
                document.body.style[CSS_USERSELECT] = '';
            }

            if (vr) {
                vr.addEventListener('mousedown', mouseDown);
                vr.addEventListener('touchstart', mouseDown);
            }

            if (hr) {
                hr.addEventListener('mousedown', mouseDown);
                hr.addEventListener('touchstart', mouseDown);
            }

            this.elements.boundary.appendChild(wrap);
        }

        function _setZoomerVal(v) {
            if (this.options.enableZoom) {
                var z = this.elements.zoomer,
                    val = fix(v, 4);

                z.value = Math.max(parseFloat(z.min), Math.min(parseFloat(z.max), val)).toString();
            }
        }

        function _initializeZoom() {
            var self = this,
                wrap = self.elements.zoomerWrap = document.createElement('div'),
                zoomer = self.elements.zoomer = document.createElement('input');

            addClass(wrap, 'cr-slider-wrap');
            addClass(zoomer, 'cr-slider');
            zoomer.type = 'range';
            zoomer.step = '0.0001';
            zoomer.value = '1';
            zoomer.style.display = self.options.showZoomer ? '' : 'none';
            zoomer.setAttribute('aria-label', 'zoom');

            self.element.appendChild(wrap);
            wrap.appendChild(zoomer);

            self._currentZoom = 1;

            function change() {
                _onZoom.call(self, {
                    value: parseFloat(zoomer.value),
                    origin: new TransformOrigin(self.elements.preview),
                    viewportRect: self.elements.viewport.getBoundingClientRect(),
                    transform: Transform.parse(self.elements.preview)
                });
            }

            function scroll(ev) {
                var delta, targetZoom;

                if(self.options.mouseWheelZoom === 'ctrl' && ev.ctrlKey !== true){
                  return 0; 
                } else if (ev.wheelDelta) {
                    delta = ev.wheelDelta / 1200; //wheelDelta min: -120 max: 120 // max x 10 x 2
                } else if (ev.deltaY) {
                    delta = ev.deltaY / 1060; //deltaY min: -53 max: 53 // max x 10 x 2
                } else if (ev.detail) {
                    delta = ev.detail / -60; //delta min: -3 max: 3 // max x 10 x 2
                } else {
                    delta = 0;
                }

                targetZoom = self._currentZoom + (delta * self._currentZoom);

                ev.preventDefault();
                _setZoomerVal.call(self, targetZoom);
                change.call(self);
            }

            self.elements.zoomer.addEventListener('input', change);// this is being fired twice on keypress
            self.elements.zoomer.addEventListener('change', change);

            if (self.options.mouseWheelZoom) {
                self.elements.boundary.addEventListener('mousewheel', scroll);
                self.elements.boundary.addEventListener('DOMMouseScroll', scroll);
            }
        }

        function _onZoom(ui) {
            var self = this,
                transform = ui ? ui.transform : Transform.parse(self.elements.preview),
                vpRect = ui ? ui.viewportRect : self.elements.viewport.getBoundingClientRect(),
                origin = ui ? ui.origin : new TransformOrigin(self.elements.preview);

            function applyCss() {
                var transCss = {};
                transCss[CSS_TRANSFORM] = transform.toString();
                transCss[CSS_TRANS_ORG] = origin.toString();
                css(self.elements.preview, transCss);
            }

            self._currentZoom = ui ? ui.value : self._currentZoom;
            transform.scale = self._currentZoom;
            self.elements.zoomer.setAttribute('aria-valuenow', self._currentZoom);
            applyCss();

            if (self.options.enforceBoundary) {
                var boundaries = _getVirtualBoundaries.call(self, vpRect),
                    transBoundaries = boundaries.translate,
                    oBoundaries = boundaries.origin;

                if (transform.x >= transBoundaries.maxX) {
                    origin.x = oBoundaries.minX;
                    transform.x = transBoundaries.maxX;
                }

                if (transform.x <= transBoundaries.minX) {
                    origin.x = oBoundaries.maxX;
                    transform.x = transBoundaries.minX;
                }

                if (transform.y >= transBoundaries.maxY) {
                    origin.y = oBoundaries.minY;
                    transform.y = transBoundaries.maxY;
                }

                if (transform.y <= transBoundaries.minY) {
                    origin.y = oBoundaries.maxY;
                    transform.y = transBoundaries.minY;
                }
            }
            applyCss();
            _debouncedOverlay.call(self);
            _triggerUpdate.call(self);
        }

        function _getVirtualBoundaries(viewport) {
            var self = this,
                scale = self._currentZoom,
                vpWidth = viewport.width,
                vpHeight = viewport.height,
                centerFromBoundaryX = self.elements.boundary.clientWidth / 2,
                centerFromBoundaryY = self.elements.boundary.clientHeight / 2,
                imgRect = self.elements.preview.getBoundingClientRect(),
                curImgWidth = imgRect.width,
                curImgHeight = imgRect.height,
                halfWidth = vpWidth / 2,
                halfHeight = vpHeight / 2;

            var maxX = ((halfWidth / scale) - centerFromBoundaryX) * -1;
            var minX = maxX - ((curImgWidth * (1 / scale)) - (vpWidth * (1 / scale)));

            var maxY = ((halfHeight / scale) - centerFromBoundaryY) * -1;
            var minY = maxY - ((curImgHeight * (1 / scale)) - (vpHeight * (1 / scale)));

            var originMinX = (1 / scale) * halfWidth;
            var originMaxX = (curImgWidth * (1 / scale)) - originMinX;

            var originMinY = (1 / scale) * halfHeight;
            var originMaxY = (curImgHeight * (1 / scale)) - originMinY;

            return {
                translate: {
                    maxX: maxX,
                    minX: minX,
                    maxY: maxY,
                    minY: minY
                },
                origin: {
                    maxX: originMaxX,
                    minX: originMinX,
                    maxY: originMaxY,
                    minY: originMinY
                }
            };
        }

        function _updateCenterPoint(rotate) {
            var self = this,
                scale = self._currentZoom,
                data = self.elements.preview.getBoundingClientRect(),
                vpData = self.elements.viewport.getBoundingClientRect(),
                transform = Transform.parse(self.elements.preview.style[CSS_TRANSFORM]),
                pc = new TransformOrigin(self.elements.preview),
                top = (vpData.top - data.top) + (vpData.height / 2),
                left = (vpData.left - data.left) + (vpData.width / 2),
                center = {},
                adj = {};

            if (rotate) {
                var cx = pc.x;
                var cy = pc.y;
                var tx = transform.x;
                var ty = transform.y;

                center.y = cx;
                center.x = cy;
                transform.y = tx;
                transform.x = ty;
            }
            else {
                center.y = top / scale;
                center.x = left / scale;

                adj.y = (center.y - pc.y) * (1 - scale);
                adj.x = (center.x - pc.x) * (1 - scale);

                transform.x -= adj.x;
                transform.y -= adj.y;
            }

            var newCss = {};
            newCss[CSS_TRANS_ORG] = center.x + 'px ' + center.y + 'px';
            newCss[CSS_TRANSFORM] = transform.toString();
            css(self.elements.preview, newCss);
        }

        function _initDraggable() {
            var self = this,
                isDragging = false,
                originalX,
                originalY,
                originalDistance,
                vpRect,
                transform;

            function assignTransformCoordinates(deltaX, deltaY) {
                var imgRect = self.elements.preview.getBoundingClientRect(),
                    top = transform.y + deltaY,
                    left = transform.x + deltaX;

                if (self.options.enforceBoundary) {
                    if (vpRect.top > imgRect.top + deltaY && vpRect.bottom < imgRect.bottom + deltaY) {
                        transform.y = top;
                    }

                    if (vpRect.left > imgRect.left + deltaX && vpRect.right < imgRect.right + deltaX) {
                        transform.x = left;
                    }
                }
                else {
                    transform.y = top;
                    transform.x = left;
                }
            }

            function toggleGrabState(isDragging) {
              self.elements.preview.setAttribute('aria-grabbed', isDragging);
              self.elements.boundary.setAttribute('aria-dropeffect', isDragging? 'move': 'none');
            }

            function keyDown(ev) {
                var LEFT_ARROW  = 37,
                    UP_ARROW    = 38,
                    RIGHT_ARROW = 39,
                    DOWN_ARROW  = 40;

                if (ev.shiftKey && (ev.keyCode === UP_ARROW || ev.keyCode === DOWN_ARROW)) {
                    var zoom;
                    if (ev.keyCode === UP_ARROW) {
                        zoom = parseFloat(self.elements.zoomer.value) + parseFloat(self.elements.zoomer.step);
                    }
                    else {
                        zoom = parseFloat(self.elements.zoomer.value) - parseFloat(self.elements.zoomer.step);
                    }
                    self.setZoom(zoom);
                }
                else if (self.options.enableKeyMovement && (ev.keyCode >= 37 && ev.keyCode <= 40)) {
                    ev.preventDefault();
                    var movement = parseKeyDown(ev.keyCode);

                    transform = Transform.parse(self.elements.preview);
                    document.body.style[CSS_USERSELECT] = 'none';
                    vpRect = self.elements.viewport.getBoundingClientRect();
                    keyMove(movement);
                }

                function parseKeyDown(key) {
                    switch (key) {
                        case LEFT_ARROW:
                            return [1, 0];
                        case UP_ARROW:
                            return [0, 1];
                        case RIGHT_ARROW:
                            return [-1, 0];
                        case DOWN_ARROW:
                            return [0, -1];
                    }
                }
            }

            function keyMove(movement) {
                var deltaX = movement[0],
                    deltaY = movement[1],
                    newCss = {};

                assignTransformCoordinates(deltaX, deltaY);

                newCss[CSS_TRANSFORM] = transform.toString();
                css(self.elements.preview, newCss);
                _updateOverlay.call(self);
                document.body.style[CSS_USERSELECT] = '';
                _updateCenterPoint.call(self);
                _triggerUpdate.call(self);
                originalDistance = 0;
            }

            function mouseDown(ev) {
                if (ev.button !== undefined && ev.button !== 0) return;

                ev.preventDefault();
                if (isDragging) return;
                isDragging = true;
                originalX = ev.pageX;
                originalY = ev.pageY;

                if (ev.touches) {
                    var touches = ev.touches[0];
                    originalX = touches.pageX;
                    originalY = touches.pageY;
                }
                toggleGrabState(isDragging);
                transform = Transform.parse(self.elements.preview);
                window.addEventListener('mousemove', mouseMove);
                window.addEventListener('touchmove', mouseMove);
                window.addEventListener('mouseup', mouseUp);
                window.addEventListener('touchend', mouseUp);
                document.body.style[CSS_USERSELECT] = 'none';
                vpRect = self.elements.viewport.getBoundingClientRect();
            }

            function mouseMove(ev) {
                ev.preventDefault();
                var pageX = ev.pageX,
                    pageY = ev.pageY;

                if (ev.touches) {
                    var touches = ev.touches[0];
                    pageX = touches.pageX;
                    pageY = touches.pageY;
                }

                var deltaX = pageX - originalX,
                    deltaY = pageY - originalY,
                    newCss = {};

                if (ev.type === 'touchmove') {
                    if (ev.touches.length > 1) {
                        var touch1 = ev.touches[0];
                        var touch2 = ev.touches[1];
                        var dist = Math.sqrt((touch1.pageX - touch2.pageX) * (touch1.pageX - touch2.pageX) + (touch1.pageY - touch2.pageY) * (touch1.pageY - touch2.pageY));

                        if (!originalDistance) {
                            originalDistance = dist / self._currentZoom;
                        }

                        var scale = dist / originalDistance;

                        _setZoomerVal.call(self, scale);
                        dispatchChange(self.elements.zoomer);
                        return;
                    }
                }

                assignTransformCoordinates(deltaX, deltaY);

                newCss[CSS_TRANSFORM] = transform.toString();
                css(self.elements.preview, newCss);
                _updateOverlay.call(self);
                originalY = pageY;
                originalX = pageX;
            }

            function mouseUp() {
                isDragging = false;
                toggleGrabState(isDragging);
                window.removeEventListener('mousemove', mouseMove);
                window.removeEventListener('touchmove', mouseMove);
                window.removeEventListener('mouseup', mouseUp);
                window.removeEventListener('touchend', mouseUp);
                document.body.style[CSS_USERSELECT] = '';
                _updateCenterPoint.call(self);
                _triggerUpdate.call(self);
                originalDistance = 0;
            }

            self.elements.overlay.addEventListener('mousedown', mouseDown);
            self.elements.viewport.addEventListener('keydown', keyDown);
            self.elements.overlay.addEventListener('touchstart', mouseDown);
        }

        function _updateOverlay() {
            if (!this.elements) return; // since this is debounced, it can be fired after destroy
            var self = this,
                boundRect = self.elements.boundary.getBoundingClientRect(),
                imgData = self.elements.preview.getBoundingClientRect();

            css(self.elements.overlay, {
                width: imgData.width + 'px',
                height: imgData.height + 'px',
                top: (imgData.top - boundRect.top) + 'px',
                left: (imgData.left - boundRect.left) + 'px'
            });
        }
        var _debouncedOverlay = debounce(_updateOverlay, 500);

        function _triggerUpdate() {
            var self = this,
                data = self.get();

            if (!_isVisible.call(self)) {
                return;
            }

            self.options.update.call(self, data);
            if (self.$ && typeof Prototype === 'undefined') {
                self.$(self.element).trigger('update.croppie', data);
            }
            else {
                var ev;
                if (window.CustomEvent) {
                    ev = new CustomEvent('update', { detail: data });
                } else {
                    ev = document.createEvent('CustomEvent');
                    ev.initCustomEvent('update', true, true, data);
                }

                self.element.dispatchEvent(ev);
            }
        }

        function _isVisible() {
            return this.elements.preview.offsetHeight > 0 && this.elements.preview.offsetWidth > 0;
        }

        function _updatePropertiesFromImage() {
            var self = this,
                initialZoom = 1,
                cssReset = {},
                img = self.elements.preview,
                imgData,
                transformReset = new Transform(0, 0, initialZoom),
                originReset = new TransformOrigin(),
                isVisible = _isVisible.call(self);

            if (!isVisible || self.data.bound) {// if the croppie isn't visible or it doesn't need binding
                return;
            }

            self.data.bound = true;
            cssReset[CSS_TRANSFORM] = transformReset.toString();
            cssReset[CSS_TRANS_ORG] = originReset.toString();
            cssReset['opacity'] = 1;
            css(img, cssReset);

            imgData = self.elements.preview.getBoundingClientRect();

            self._originalImageWidth = imgData.width;
            self._originalImageHeight = imgData.height;
            self.data.orientation = getExifOrientation(self.elements.img);

            if (self.options.enableZoom) {
                _updateZoomLimits.call(self, true);
            }
            else {
                self._currentZoom = initialZoom;
            }

            transformReset.scale = self._currentZoom;
            cssReset[CSS_TRANSFORM] = transformReset.toString();
            css(img, cssReset);

            if (self.data.points.length) {
                _bindPoints.call(self, self.data.points);
            }
            else {
                _centerImage.call(self);
            }

            _updateCenterPoint.call(self);
            _updateOverlay.call(self);
        }

        function _updateZoomLimits (initial) {
            var self = this,
                minZoom = Math.max(self.options.minZoom, 0) || 0,
                maxZoom = self.options.maxZoom || 1.5,
                initialZoom,
                defaultInitialZoom,
                zoomer = self.elements.zoomer,
                scale = parseFloat(zoomer.value),
                boundaryData = self.elements.boundary.getBoundingClientRect(),
                imgData = naturalImageDimensions(self.elements.img, self.data.orientation),
                vpData = self.elements.viewport.getBoundingClientRect(),
                minW,
                minH;
            if (self.options.enforceBoundary) {
                minW = vpData.width / imgData.width;
                minH = vpData.height / imgData.height;
                minZoom = Math.max(minW, minH);
            }

            if (minZoom >= maxZoom) {
                maxZoom = minZoom + 1;
            }

            zoomer.min = fix(minZoom, 4);
            zoomer.max = fix(maxZoom, 4);
            
            if (!initial && (scale < zoomer.min || scale > zoomer.max)) {
                _setZoomerVal.call(self, scale < zoomer.min ? zoomer.min : zoomer.max);
            }
            else if (initial) {
                defaultInitialZoom = Math.max((boundaryData.width / imgData.width), (boundaryData.height / imgData.height));
                initialZoom = self.data.boundZoom !== null ? self.data.boundZoom : defaultInitialZoom;
                _setZoomerVal.call(self, initialZoom);
            }

            dispatchChange(zoomer);
        }

        function _bindPoints(points) {
            if (points.length !== 4) {
                throw "Croppie - Invalid number of points supplied: " + points;
            }
            var self = this,
                pointsWidth = points[2] - points[0],
                // pointsHeight = points[3] - points[1],
                vpData = self.elements.viewport.getBoundingClientRect(),
                boundRect = self.elements.boundary.getBoundingClientRect(),
                vpOffset = {
                    left: vpData.left - boundRect.left,
                    top: vpData.top - boundRect.top
                },
                scale = vpData.width / pointsWidth,
                originTop = points[1],
                originLeft = points[0],
                transformTop = (-1 * points[1]) + vpOffset.top,
                transformLeft = (-1 * points[0]) + vpOffset.left,
                newCss = {};

            newCss[CSS_TRANS_ORG] = originLeft + 'px ' + originTop + 'px';
            newCss[CSS_TRANSFORM] = new Transform(transformLeft, transformTop, scale).toString();
            css(self.elements.preview, newCss);

            _setZoomerVal.call(self, scale);
            self._currentZoom = scale;
        }

        function _centerImage() {
            var self = this,
                imgDim = self.elements.preview.getBoundingClientRect(),
                vpDim = self.elements.viewport.getBoundingClientRect(),
                boundDim = self.elements.boundary.getBoundingClientRect(),
                vpLeft = vpDim.left - boundDim.left,
                vpTop = vpDim.top - boundDim.top,
                w = vpLeft - ((imgDim.width - vpDim.width) / 2),
                h = vpTop - ((imgDim.height - vpDim.height) / 2),
                transform = new Transform(w, h, self._currentZoom);

            css(self.elements.preview, CSS_TRANSFORM, transform.toString());
        }

        function _transferImageToCanvas(customOrientation) {
            var self = this,
                canvas = self.elements.canvas,
                img = self.elements.img,
                ctx = canvas.getContext('2d');

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = img.width;
            canvas.height = img.height;

            var orientation = self.options.enableOrientation && customOrientation || getExifOrientation(img);
            drawCanvas(canvas, img, orientation);
        }

        function _getCanvas(data) {
            var self = this,
                points = data.points,
                left = num(points[0]),
                top = num(points[1]),
                right = num(points[2]),
                bottom = num(points[3]),
                width = right-left,
                height = bottom-top,
                circle = data.circle,
                canvas = document.createElement('canvas'),
                ctx = canvas.getContext('2d'),
                canvasWidth = data.outputWidth || width,
                canvasHeight = data.outputHeight || height;

            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            if (data.backgroundColor) {
                ctx.fillStyle = data.backgroundColor;
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            }

            // By default assume we're going to draw the entire
            // source image onto the destination canvas.
            var sx = left,
                sy = top,
                sWidth = width,
                sHeight = height,
                dx = 0,
                dy = 0,
                dWidth = canvasWidth,
                dHeight = canvasHeight;

            //
            // Do not go outside of the original image's bounds along the x-axis.
            // Handle translations when projecting onto the destination canvas.
            //

            // The smallest possible source x-position is 0.
            if (left < 0) {
                sx = 0;
                dx = (Math.abs(left) / width) * canvasWidth;
            }

            // The largest possible source width is the original image's width.
            if (sWidth + sx > self._originalImageWidth) {
                sWidth = self._originalImageWidth - sx;
                dWidth =  (sWidth / width) * canvasWidth;
            }

            //
            // Do not go outside of the original image's bounds along the y-axis.
            //

            // The smallest possible source y-position is 0.
            if (top < 0) {
                sy = 0;
                dy = (Math.abs(top) / height) * canvasHeight;
            }

            // The largest possible source height is the original image's height.
            if (sHeight + sy > self._originalImageHeight) {
                sHeight = self._originalImageHeight - sy;
                dHeight = (sHeight / height) * canvasHeight;
            }

            // console.table({ left, right, top, bottom, canvasWidth, canvasHeight, width, height, startX, startY, circle, sx, sy, dx, dy, sWidth, sHeight, dWidth, dHeight });

            ctx.drawImage(this.elements.preview, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
            if (circle) {
                ctx.fillStyle = '#fff';
                ctx.globalCompositeOperation = 'destination-in';
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.fill();
            }
            return canvas;
        }

        function _getHtmlResult(data) {
            var points = data.points,
                div = document.createElement('div'),
                img = document.createElement('img'),
                width = points[2] - points[0],
                height = points[3] - points[1];

            addClass(div, 'croppie-result');
            div.appendChild(img);
            css(img, {
                left: (-1 * points[0]) + 'px',
                top: (-1 * points[1]) + 'px'
            });
            img.src = data.url;
            css(div, {
                width: width + 'px',
                height: height + 'px'
            });

            return div;
        }

        function _getBase64Result(data) {
            return _getCanvas.call(this, data).toDataURL(data.format, data.quality);
        }

        function _getBlobResult(data) {
            var self = this;
            return new Promise(function (resolve) {
                _getCanvas.call(self, data).toBlob(function (blob) {
                    resolve(blob);
                }, data.format, data.quality);
            });
        }

        function _replaceImage(img) {
            if (this.elements.img.parentNode) {
                Array.prototype.forEach.call(this.elements.img.classList, function(c) { img.classList.add(c); });
                this.elements.img.parentNode.replaceChild(img, this.elements.img);
                this.elements.preview = img; // if the img is attached to the DOM, they're not using the canvas
            }
            this.elements.img = img;
        }

        function _bind(options, cb) {
            var self = this,
                url,
                points = [],
                zoom = null,
                hasExif = _hasExif.call(self);

            if (typeof (options) === 'string') {
                url = options;
                options = {};
            }
            else if (Array.isArray(options)) {
                points = options.slice();
            }
            else if (typeof (options) === 'undefined' && self.data.url) { //refreshing
                _updatePropertiesFromImage.call(self);
                _triggerUpdate.call(self);
                return null;
            }
            else {
                url = options.url;
                points = options.points || [];
                zoom = typeof(options.zoom) === 'undefined' ? null : options.zoom;
            }

            self.data.bound = false;
            self.data.url = url || self.data.url;
            self.data.boundZoom = zoom;

            return loadImage(url, hasExif).then(function (img) {
                _replaceImage.call(self, img);
                if (!points.length) {
                    var natDim = naturalImageDimensions(img);
                    var rect = self.elements.viewport.getBoundingClientRect();
                    var aspectRatio = rect.width / rect.height;
                    var imgAspectRatio = natDim.width / natDim.height;
                    var width, height;

                    if (imgAspectRatio > aspectRatio) {
                        height = natDim.height;
                        width = height * aspectRatio;
                    }
                    else {
                        width = natDim.width;
                        height = natDim.height / aspectRatio;
                    }

                    var x0 = (natDim.width - width) / 2;
                    var y0 = (natDim.height - height) / 2;
                    var x1 = x0 + width;
                    var y1 = y0 + height;
                    self.data.points = [x0, y0, x1, y1];
                }
                else if (self.options.relative) {
                    points = [
                        points[0] * img.naturalWidth / 100,
                        points[1] * img.naturalHeight / 100,
                        points[2] * img.naturalWidth / 100,
                        points[3] * img.naturalHeight / 100
                    ];
                }

                self.data.points = points.map(function (p) {
                    return parseFloat(p);
                });
                if (self.options.useCanvas) {
                    _transferImageToCanvas.call(self, options.orientation);
                }
                _updatePropertiesFromImage.call(self);
                _triggerUpdate.call(self);
                cb && cb();
            });
        }

        function fix(v, decimalPoints) {
            return parseFloat(v).toFixed(decimalPoints || 0);
        }

        function _get() {
            var self = this,
                imgData = self.elements.preview.getBoundingClientRect(),
                vpData = self.elements.viewport.getBoundingClientRect(),
                x1 = vpData.left - imgData.left,
                y1 = vpData.top - imgData.top,
                widthDiff = (vpData.width - self.elements.viewport.offsetWidth) / 2, //border
                heightDiff = (vpData.height - self.elements.viewport.offsetHeight) / 2,
                x2 = x1 + self.elements.viewport.offsetWidth + widthDiff,
                y2 = y1 + self.elements.viewport.offsetHeight + heightDiff,
                scale = self._currentZoom;

            if (scale === Infinity || isNaN(scale)) {
                scale = 1;
            }

            var max = self.options.enforceBoundary ? 0 : Number.NEGATIVE_INFINITY;
            x1 = Math.max(max, x1 / scale);
            y1 = Math.max(max, y1 / scale);
            x2 = Math.max(max, x2 / scale);
            y2 = Math.max(max, y2 / scale);

            return {
                points: [fix(x1), fix(y1), fix(x2), fix(y2)],
                zoom: scale,
                orientation: self.data.orientation
            };
        }

        var RESULT_DEFAULTS = {
                type: 'canvas',
                format: 'png',
                quality: 1
            },
            RESULT_FORMATS = ['jpeg', 'webp', 'png'];

        function _result(options) {
            var self = this,
                data = _get.call(self),
                opts = deepExtend(clone(RESULT_DEFAULTS), clone(options)),
                resultType = (typeof (options) === 'string' ? options : (opts.type || 'base64')),
                size = opts.size || 'viewport',
                format = opts.format,
                quality = opts.quality,
                backgroundColor = opts.backgroundColor,
                circle = typeof opts.circle === 'boolean' ? opts.circle : (self.options.viewport.type === 'circle'),
                vpRect = self.elements.viewport.getBoundingClientRect(),
                ratio = vpRect.width / vpRect.height,
                prom;

            if (size === 'viewport') {
                data.outputWidth = vpRect.width;
                data.outputHeight = vpRect.height;
            } else if (typeof size === 'object') {
                if (size.width && size.height) {
                    data.outputWidth = size.width;
                    data.outputHeight = size.height;
                } else if (size.width) {
                    data.outputWidth = size.width;
                    data.outputHeight = size.width / ratio;
                } else if (size.height) {
                    data.outputWidth = size.height * ratio;
                    data.outputHeight = size.height;
                }
            }

            if (RESULT_FORMATS.indexOf(format) > -1) {
                data.format = 'image/' + format;
                data.quality = quality;
            }

            data.circle = circle;
            data.url = self.data.url;
            data.backgroundColor = backgroundColor;

            prom = new Promise(function (resolve) {
                switch(resultType.toLowerCase())
                {
                    case 'rawcanvas':
                        resolve(_getCanvas.call(self, data));
                        break;
                    case 'canvas':
                    case 'base64':
                        resolve(_getBase64Result.call(self, data));
                        break;
                    case 'blob':
                        _getBlobResult.call(self, data).then(resolve);
                        break;
                    default:
                        resolve(_getHtmlResult.call(self, data));
                        break;
                }
            });
            return prom;
        }

        function _refresh() {
            _updatePropertiesFromImage.call(this);
        }

        function _rotate(deg) {
            if (!this.options.useCanvas || !this.options.enableOrientation) {
                throw 'Croppie: Cannot rotate without enableOrientation && EXIF.js included';
            }

            var self = this,
                canvas = self.elements.canvas;

            self.data.orientation = getExifOffset(self.data.orientation, deg);
            drawCanvas(canvas, self.elements.img, self.data.orientation);
            _updateCenterPoint.call(self, true);
            _updateZoomLimits.call(self);
        }

        function _destroy() {
            var self = this;
            self.element.removeChild(self.elements.boundary);
            removeClass(self.element, 'croppie-container');
            if (self.options.enableZoom) {
                self.element.removeChild(self.elements.zoomerWrap);
            }
            delete self.elements;
        }

        if (window.jQuery) {
            var $ = window.jQuery;
            $.fn.croppie = function (opts) {
                var ot = typeof opts;

                if (ot === 'string') {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var singleInst = $(this).data('croppie');

                    if (opts === 'get') {
                        return singleInst.get();
                    }
                    else if (opts === 'result') {
                        return singleInst.result.apply(singleInst, args);
                    }
                    else if (opts === 'bind') {
                        return singleInst.bind.apply(singleInst, args);
                    }

                    return this.each(function () {
                        var i = $(this).data('croppie');
                        if (!i) return;

                        var method = i[opts];
                        if ($.isFunction(method)) {
                            method.apply(i, args);
                            if (opts === 'destroy') {
                                $(this).removeData('croppie');
                            }
                        }
                        else {
                            throw 'Croppie ' + opts + ' method not found';
                        }
                    });
                }
                else {
                    return this.each(function () {
                        var i = new Croppie(this, opts);
                        i.$ = $;
                        $(this).data('croppie', i);
                    });
                }
            };
        }

        function Croppie(element, opts) {
            if (element.className.indexOf('croppie-container') > -1) {
                throw new Error("Croppie: Can't initialize croppie more than once");
            }
            this.element = element;
            this.options = deepExtend(clone(Croppie.defaults), opts);

            if (this.element.tagName.toLowerCase() === 'img') {
                var origImage = this.element;
                addClass(origImage, 'cr-original-image');
                setAttributes(origImage, {'aria-hidden' : 'true', 'alt' : '' });
                var replacementDiv = document.createElement('div');
                this.element.parentNode.appendChild(replacementDiv);
                replacementDiv.appendChild(origImage);
                this.element = replacementDiv;
                this.options.url = this.options.url || origImage.src;
            }

            _create.call(this);
            if (this.options.url) {
                var bindOpts = {
                    url: this.options.url,
                    points: this.options.points
                };
                delete this.options['url'];
                delete this.options['points'];
                _bind.call(this, bindOpts);
            }
        }

        Croppie.defaults = {
            viewport: {
                width: 100,
                height: 100,
                type: 'square'
            },
            boundary: { },
            orientationControls: {
                enabled: true,
                leftClass: '',
                rightClass: ''
            },
            resizeControls: {
                width: true,
                height: true
            },
            customClass: '',
            showZoomer: true,
            enableZoom: true,
            enableResize: false,
            mouseWheelZoom: true,
            enableExif: false,
            enforceBoundary: true,
            enableOrientation: false,
            enableKeyMovement: true,
            update: function () { }
        };

        Croppie.globals = {
            translate: 'translate3d'
        };

        deepExtend(Croppie.prototype, {
            bind: function (options, cb) {
                return _bind.call(this, options, cb);
            },
            get: function () {
                var data = _get.call(this);
                var points = data.points;
                if (this.options.relative) {
                    points[0] /= this.elements.img.naturalWidth / 100;
                    points[1] /= this.elements.img.naturalHeight / 100;
                    points[2] /= this.elements.img.naturalWidth / 100;
                    points[3] /= this.elements.img.naturalHeight / 100;
                }
                return data;
            },
            result: function (type) {
                return _result.call(this, type);
            },
            refresh: function () {
                return _refresh.call(this);
            },
            setZoom: function (v) {
                _setZoomerVal.call(this, v);
                dispatchChange(this.elements.zoomer);
            },
            rotate: function (deg) {
                _rotate.call(this, deg);
            },
            destroy: function () {
                return _destroy.call(this);
            }
        });
        return Croppie;
    }));
    });

    var VueCroppieComponent = {
      name: 'VueCroppie',
      render: function render$$1() {
        return h('div', {
          class: this.customClass,
          ref: 'croppieContainer',
          id: 'croppieContainer'
        });
      },
      props: {
        boundary: Object,
        customClass: String,
        enableExif: Boolean,
        enableOrientation: {
          type: Boolean,
          default: true
        },
        enableResize: {
          type: Boolean,
          default: true
        },
        enableZoom: {
          type: Boolean,
          default: true
        },
        enforceBoundary: {
          type: Boolean,
          default: true
        },
        mouseWheelZoom: {
          type: [Boolean, String],
          default: true
        },
        showZoomer: {
          type: Boolean,
          default: true
        },
        croppieInitialized: {
          type: Function,
          default: function _default() {}
        },
        viewport: {
          type: Object,
          default: function _default() {
            return {
              width: 200,
              height: 200,
              type: 'square'
            };
          }
        },
        minZoom: Number,
        maxZoom: Number
      },
      mounted: function mounted() {
        this.initCroppie();
      },
      data: function data() {
        return {
          croppie: null
        };
      },
      methods: {
        initCroppie: function initCroppie() {
          var _this = this;

          var el = this.$refs.croppieContainer;
          var options = {
            enableExif: this.enableExif,
            enableOrientation: this.enableOrientation,
            enableZoom: this.enableZoom,
            enableResize: this.enableResize,
            enforceBoundary: this.enforceBoundary,
            mouseWheelZoom: this.mouseWheelZoom,
            viewport: this.viewport,
            showZoomer: this.showZoomer,
            minZoom: this.minZoom,
            maxZoom: this.maxZoom
          };

          if (this.boundary) {
            options.boundary = this.boundary;
          }

          el.addEventListener('update', function (ev) {
            _this.$emit('update', ev.detail);
          });
          this.croppie = new croppie(el, options);
          this.croppieInitialized();
        },
        bind: function bind(options) {
          return this.croppie.bind(options);
        },
        destroy: function destroy() {
          this.croppie.destroy();
        },
        get: function get(cb) {
          if (cb) {
            cb(this.croppie.get());
          } else {
            return this.croppie.get();
          }
        },
        rotate: function rotate(angle) {
          this.croppie.rotate(angle);
        },
        setZoom: function setZoom(value) {
          this.croppie.setZoom(value);
        },
        result: function result(options, cb) {
          var _this2 = this;

          if (!options) options = {
            type: 'base64'
          };
          return this.croppie.result(options).then(function (output) {
            if (!cb) {
              _this2.$emit('result', output);
            } else {
              cb(output);
            }

            return output;
          });
        },
        refresh: function refresh() {
          this.croppie.destroy();
          this.initCroppie();
        }
      }
    };

    var VueCroppie = {
      install: function install(Vue, options) {
        Vue.component(VueCroppieComponent.name, VueCroppieComponent);
      }
    };

    if (window && window.Vue) {
      Vue.use(VueCroppie);
    }

    exports.default = VueCroppie;
    exports.VueCroppieComponent = VueCroppieComponent;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
