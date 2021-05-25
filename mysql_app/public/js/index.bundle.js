var index = (function () {
    'use strict';

    function noop() { }
    function is_promise(value) {
        return value && typeof value === 'object' && typeof value.then === 'function';
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function handle_promise(promise, info) {
        const token = info.token = {};
        function update(type, index, key, value) {
            if (info.token !== token)
                return;
            info.resolved = value;
            let child_ctx = info.ctx;
            if (key !== undefined) {
                child_ctx = child_ctx.slice();
                child_ctx[key] = value;
            }
            const block = type && (info.current = type)(child_ctx);
            let needs_flush = false;
            if (info.block) {
                if (info.blocks) {
                    info.blocks.forEach((block, i) => {
                        if (i !== index && block) {
                            group_outros();
                            transition_out(block, 1, 1, () => {
                                if (info.blocks[i] === block) {
                                    info.blocks[i] = null;
                                }
                            });
                            check_outros();
                        }
                    });
                }
                else {
                    info.block.d(1);
                }
                block.c();
                transition_in(block, 1);
                block.m(info.mount(), info.anchor);
                needs_flush = true;
            }
            info.block = block;
            if (info.blocks)
                info.blocks[index] = block;
            if (needs_flush) {
                flush();
            }
        }
        if (is_promise(promise)) {
            const current_component = get_current_component();
            promise.then(value => {
                set_current_component(current_component);
                update(info.then, 1, info.value, value);
                set_current_component(null);
            }, error => {
                set_current_component(current_component);
                update(info.catch, 2, info.error, error);
                set_current_component(null);
                if (!info.hasCatch) {
                    throw error;
                }
            });
            // if we previously had a then/catch block, destroy it
            if (info.current !== info.pending) {
                update(info.pending, 0);
                return true;
            }
        }
        else {
            if (info.current !== info.then) {
                update(info.then, 1, info.value, promise);
                return true;
            }
            info.resolved = promise;
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const isOpen = writable(false);
    const open = () => isOpen.update(t => true);
    const close = () => isOpen.update(t => false);

    const fileId = writable(-1);
    const fileIdUpdate = (id) => fileId.update(x => id);

    /* src/components/ContentModal.svelte generated by Svelte v3.37.0 */

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-tiuzqf-style";
    	style.textContent = ".n_modal_bg.svelte-tiuzqf.svelte-tiuzqf{width:100%;height:100%;background-color:rgba(0, 0, 0, 0.5);position:fixed;top:0;left:0;z-index:1;display:grid;justify-content:center;align-content:center}.n_modal.svelte-tiuzqf.svelte-tiuzqf{z-index:2;width:100%;height:60%;overflow-y:auto;word-break:break-all;background-color:rgb(0, 0, 0);background-color:rgba(0, 0, 0, 0.4)}.n_modal.svelte-tiuzqf pre.svelte-tiuzqf{white-space:pre-wrap}";
    	append(document.head, style);
    }

    // (52:0) {#if $isOpen}
    function create_if_block(ctx) {
    	let await_block_anchor;
    	let promise_1;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: true,
    		pending: create_pending_block$1,
    		then: create_then_block$1,
    		catch: create_catch_block$1,
    		value: 5,
    		error: 6
    	};

    	handle_promise(promise_1 = /*promise*/ ctx[1], info);

    	return {
    		c() {
    			await_block_anchor = empty();
    			info.block.c();
    		},
    		m(target, anchor) {
    			insert(target, await_block_anchor, anchor);
    			info.block.m(target, info.anchor = anchor);
    			info.mount = () => await_block_anchor.parentNode;
    			info.anchor = await_block_anchor;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*promise*/ 2 && promise_1 !== (promise_1 = /*promise*/ ctx[1]) && handle_promise(promise_1, info)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[5] = child_ctx[6] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(await_block_anchor);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
    		}
    	};
    }

    // (79:2) {:catch error}
    function create_catch_block$1(ctx) {
    	let p;
    	let t_value = /*error*/ ctx[6].message + "";
    	let t;

    	return {
    		c() {
    			p = element("p");
    			t = text(t_value);
    			set_style(p, "color", "red");
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*promise*/ 2 && t_value !== (t_value = /*error*/ ctx[6].message + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (55:2) {:then data}
    function create_then_block$1(ctx) {
    	let div5;
    	let div4;
    	let div3;
    	let div0;
    	let h5;
    	let t0_value = (/*data*/ ctx[5].title ?? "") + "";
    	let t0;
    	let t1;
    	let button0;
    	let t3;
    	let div1;
    	let pre;
    	let t4_value = (/*data*/ ctx[5].content ?? "") + "";
    	let t4;
    	let t5;
    	let div2;
    	let button1;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div5 = element("div");
    			div4 = element("div");
    			div3 = element("div");
    			div0 = element("div");
    			h5 = element("h5");
    			t0 = text(t0_value);
    			t1 = space();
    			button0 = element("button");
    			button0.innerHTML = `<span aria-hidden="true">×</span>`;
    			t3 = space();
    			div1 = element("div");
    			pre = element("pre");
    			t4 = text(t4_value);
    			t5 = space();
    			div2 = element("div");
    			button1 = element("button");
    			button1.textContent = "Close";
    			attr(h5, "class", "modal-title");
    			attr(button0, "type", "button");
    			attr(button0, "class", "close");
    			attr(div0, "class", "modal-header");
    			attr(pre, "class", "svelte-tiuzqf");
    			attr(div1, "class", "modal-body");
    			attr(button1, "type", "button");
    			attr(button1, "class", "btn btn-secondary");
    			attr(div2, "class", "modal-footer");
    			attr(div3, "class", "modal-content");
    			attr(div4, "class", "n_modal svelte-tiuzqf");
    			attr(div5, "class", "n_modal_bg svelte-tiuzqf");
    		},
    		m(target, anchor) {
    			insert(target, div5, anchor);
    			append(div5, div4);
    			append(div4, div3);
    			append(div3, div0);
    			append(div0, h5);
    			append(h5, t0);
    			append(div0, t1);
    			append(div0, button0);
    			append(div3, t3);
    			append(div3, div1);
    			append(div1, pre);
    			append(pre, t4);
    			append(div3, t5);
    			append(div3, div2);
    			append(div2, button1);

    			if (!mounted) {
    				dispose = [listen(button0, "click", close), listen(button1, "click", close)];
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*promise*/ 2 && t0_value !== (t0_value = (/*data*/ ctx[5].title ?? "") + "")) set_data(t0, t0_value);
    			if (dirty & /*promise*/ 2 && t4_value !== (t4_value = (/*data*/ ctx[5].content ?? "") + "")) set_data(t4, t4_value);
    		},
    		d(detaching) {
    			if (detaching) detach(div5);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (53:18)      <p />   {:then data}
    function create_pending_block$1(ctx) {
    	let p;

    	return {
    		c() {
    			p = element("p");
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let if_block = /*$isOpen*/ ctx[0] && create_if_block(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, [dirty]) {
    			if (/*$isOpen*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    const baseAPI$1 = "wasu-arch:4000";

    function instance$1($$self, $$props, $$invalidate) {
    	let $isOpen;
    	let $fileId;
    	component_subscribe($$self, isOpen, $$value => $$invalidate(0, $isOpen = $$value));
    	component_subscribe($$self, fileId, $$value => $$invalidate(2, $fileId = $$value));
    	const baseAPIURL = `http://${baseAPI$1}/api/v1`;
    	let promise = Promise.resolve([]);

    	async function readFile(id) {
    		const fetchURL = new URL(`${baseAPIURL}/file?id=${id}`);
    		const resp = await fetch(fetchURL);

    		if (resp.ok) {
    			return resp.json();
    		} else {
    			throw new Error("Invalid Response.");
    		}
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$isOpen, $fileId*/ 5) {
    			{
    				if ($isOpen) {
    					$$invalidate(1, promise = readFile($fileId));
    				}
    			}
    		}
    	};

    	return [$isOpen, promise, $fileId];
    }

    class ContentModal extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document.getElementById("svelte-tiuzqf-style")) add_css();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
    	}
    }

    /* src/Index.svelte generated by Svelte v3.37.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (73:2) {:catch error}
    function create_catch_block(ctx) {
    	let p;
    	let t_value = /*error*/ ctx[12].message + "";
    	let t;

    	return {
    		c() {
    			p = element("p");
    			t = text(t_value);
    			set_style(p, "color", "red");
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*promise*/ 2 && t_value !== (t_value = /*error*/ ctx[12].message + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (51:2) {:then data}
    function create_then_block(ctx) {
    	let section;
    	let div2;
    	let div0;
    	let t0_value = (/*data*/ ctx[8].time ?? "") + "";
    	let t0;
    	let t1;
    	let div1;
    	let each_value = /*data*/ ctx[8].articles ?? [];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			section = element("section");
    			div2 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(div0, "class", "row");
    			attr(div1, "class", "row");
    			attr(div2, "class", "container");
    			attr(section, "class", "main");
    		},
    		m(target, anchor) {
    			insert(target, section, anchor);
    			append(section, div2);
    			append(div2, div0);
    			append(div0, t0);
    			append(div2, t1);
    			append(div2, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*promise*/ 2 && t0_value !== (t0_value = (/*data*/ ctx[8].time ?? "") + "")) set_data(t0, t0_value);

    			if (dirty & /*handleFileRead, promise*/ 10) {
    				each_value = /*data*/ ctx[8].articles ?? [];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(section);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (58:10) {#each data.articles ?? [] as article}
    function create_each_block(ctx) {
    	let div1;
    	let div0;
    	let h5;
    	let t0_value = /*article*/ ctx[9].title + "";
    	let t0;
    	let t1;
    	let p;
    	let t2_value = /*article*/ ctx[9].parts_of_content + "";
    	let t2;
    	let t3;
    	let t4;
    	let button;
    	let t6;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[5](/*article*/ ctx[9]);
    	}

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			h5 = element("h5");
    			t0 = text(t0_value);
    			t1 = space();
    			p = element("p");
    			t2 = text(t2_value);
    			t3 = text("...");
    			t4 = space();
    			button = element("button");
    			button.textContent = "Read";
    			t6 = space();
    			attr(h5, "class", "card-title");
    			attr(p, "class", "card-text");
    			attr(button, "class", "btn btn-primary");
    			attr(div0, "class", "card-body");
    			attr(div1, "class", "card col-3");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div0, h5);
    			append(h5, t0);
    			append(div0, t1);
    			append(div0, p);
    			append(p, t2);
    			append(p, t3);
    			append(div0, t4);
    			append(div0, button);
    			append(div1, t6);

    			if (!mounted) {
    				dispose = listen(button, "click", click_handler);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*promise*/ 2 && t0_value !== (t0_value = /*article*/ ctx[9].title + "")) set_data(t0, t0_value);
    			if (dirty & /*promise*/ 2 && t2_value !== (t2_value = /*article*/ ctx[9].parts_of_content + "")) set_data(t2, t2_value);
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (49:18)      <p>please search...</p>   {:then data}
    function create_pending_block(ctx) {
    	let p;

    	return {
    		c() {
    			p = element("p");
    			p.textContent = "please search...";
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div1;
    	let nav;
    	let a;
    	let t1;
    	let div0;
    	let input;
    	let t2;
    	let button;
    	let t4;
    	let modal;
    	let t5;
    	let promise_1;
    	let t6;
    	let footer;
    	let current;
    	let mounted;
    	let dispose;
    	modal = new ContentModal({});

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: true,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block,
    		value: 8,
    		error: 12
    	};

    	handle_promise(promise_1 = /*promise*/ ctx[1], info);

    	return {
    		c() {
    			div1 = element("div");
    			nav = element("nav");
    			a = element("a");
    			a.textContent = "Bluesky Search";
    			t1 = space();
    			div0 = element("div");
    			input = element("input");
    			t2 = space();
    			button = element("button");
    			button.textContent = "Search";
    			t4 = space();
    			create_component(modal.$$.fragment);
    			t5 = space();
    			info.block.c();
    			t6 = space();
    			footer = element("footer");
    			footer.textContent = "footer";
    			attr(a, "class", "navbar-brand");
    			attr(a, "href", "/");
    			attr(input, "class", "form-control mr-sm-2");
    			attr(input, "type", "search");
    			attr(input, "placeholder", "Search");
    			attr(input, "aria-label", "Search");
    			attr(button, "class", "btn btn-outline-success my-2 my-sm-0");
    			attr(button, "type", "submit");
    			attr(div0, "class", "navbar-collapse");
    			attr(nav, "class", "navbar navbar-expand-lg navbar-light bg-light");
    			attr(footer, "class", "footer");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, nav);
    			append(nav, a);
    			append(nav, t1);
    			append(nav, div0);
    			append(div0, input);
    			set_input_value(input, /*query*/ ctx[0]);
    			append(div0, t2);
    			append(div0, button);
    			append(div1, t4);
    			mount_component(modal, div1, null);
    			append(div1, t5);
    			info.block.m(div1, info.anchor = null);
    			info.mount = () => div1;
    			info.anchor = t6;
    			append(div1, t6);
    			append(div1, footer);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler*/ ctx[4]),
    					listen(button, "click", /*handleSearch*/ ctx[2])
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (dirty & /*query*/ 1) {
    				set_input_value(input, /*query*/ ctx[0]);
    			}

    			info.ctx = ctx;

    			if (dirty & /*promise*/ 2 && promise_1 !== (promise_1 = /*promise*/ ctx[1]) && handle_promise(promise_1, info)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[8] = child_ctx[12] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(modal.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(modal.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			destroy_component(modal);
    			info.block.d();
    			info.token = null;
    			info = null;
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    const baseAPI = "wasu-arch:4000";

    function instance($$self, $$props, $$invalidate) {
    	const baseAPIURL = `http://${baseAPI}/api/v1`;
    	let query = "";
    	let promise = Promise.resolve([]);

    	async function searchReq() {
    		const fetchURL = new URL(`${baseAPIURL}/search?q=${query}`);
    		const resp = await fetch(fetchURL);

    		if (resp.ok) {
    			return resp.json();
    		} else {
    			throw new Error("Invalid Response.");
    		}
    	}

    	function handleSearch() {
    		$$invalidate(1, promise = searchReq());
    	}

    	function handleFileRead(id) {
    		fileIdUpdate(id);
    		open();
    	}

    	function input_input_handler() {
    		query = this.value;
    		$$invalidate(0, query);
    	}

    	const click_handler = article => handleFileRead(article.id);

    	return [
    		query,
    		promise,
    		handleSearch,
    		handleFileRead,
    		input_input_handler,
    		click_handler
    	];
    }

    class Index extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const index = new Index({
      target: document.body,
    });

    return index;

}());
