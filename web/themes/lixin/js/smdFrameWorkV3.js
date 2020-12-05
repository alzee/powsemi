/*
 *smd前端脚本核心独立框架
 *v1.0.0
 */
$smd = {};
$.extend($smd, {
    version: "1.0.0",
    alert: function (msg) {
        msg = "<span style='color:#FF3E3E;font-weight:bold;font-size:15px'>" + msg + "<span>";
        top.smdui.alert({
            //type: "error",
            //title: "错误提示",
            text: msg
        });
    },
    tips: function (msg, times) {
        times = times || 3000;
        top.smdui.message({ "text": msg, "type": "info", "expire": times })
    },
    errorTips: function (msg, times) {
        times = times || 3000;
        top.smdui.message({ "text": msg, "type": "error", "expire": times })
    },
    errorTipsShow: function (msg) {
        top.smdui.message({ "text": msg, "type": "error", "expire": -1 })
    },
    confirm: function (msg, back) {
        top.smdui.confirm({
            title: "确认框",
            ok: "Yes",
            cancel: "No",
            type: "confirm-error",
            text: msg,
            callback: function (result) {
                back(result);
            }
        });
    },
    urlParam: function (name) {
        //构造一个含有目标参数的正则表达式对象  
        var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
        //匹配目标参数  
        var r = window.location.search.substr(1).match(reg);
        //返回参数值  
        if (r != null) return unescape(r[2]);
        return null;
    },
    trim: function (value) {
        value = value.replace(/^ */g, '');
        value = value.replace(/ *$/g, '');
        return value;
    },
    formatFloat: function (f, digit) {
        var m = Math.pow(10, digit);
        return parseInt(f * m, 10) / m;
    },
    getCursortPosition: function (ctrl) {//获取光标位置函数
        var end = 0;
        if (document.selection) {    // IE Support
            //ctrl.focus();
            var range = document.selection.createRange();
            if (ctrl.tagName == "INPUT") {
                range.moveStart('character', -ctrl.value.length);
                end = range.text.length;
            } else if (ctrl.tagName == "TEXTAREA") { //TEXTAREA
                if (range.parentElement().id == ctrl.id) {
                    var range_all = document.body.createTextRange();
                    range_all.moveToElementText(ctrl);
                }
                for (end = 0; range_all.compareEndPoints('StartToEnd', range) < 0; end++)
                    range_all.moveStart('character', 1);
                for (var i = 0; i <= end; i++) {
                    if (ctrl.value.charAt(i) == '"n')
                        end++;
                }
            }
        } else if (ctrl.selectionEnd || ctrl.selectionEnd == '0') {// Firefox support 
            end = ctrl.selectionEnd;
        }
        return end;
    },
    focusAtEnd: function (inputEl) {
        if (inputEl) {
            if (inputEl.value.length) {
                if (inputEl.createTextRange) {
                    var FieldRange = inputEl.createTextRange();
                    FieldRange.moveStart('character', inputEl.value.length);
                    FieldRange.collapse();
                    FieldRange.select();
                } else if (inputEl.selectionStart || inputEl.selectionStart == '0') {
                    var elemLen = inputEl.value.length;
                    inputEl.selectionStart = elemLen;
                    inputEl.selectionEnd = elemLen;
                }
            }
        }
    }
});

$smd.win = (function () {
    var obj = {};
    obj.config = {};
    obj.open = function (opt) {
        var def_opts = {
            id: "win" + new Date().valueOf(),
            parentId: "",
            height: 400, width: 550,
            move: true,
            modal: true,
            maximize:false,
            close: true,
            resize: false,
            fullscreen: false,
            title: "",
            href: "",
            onclosed: null
        }
        var nopts = $.extend(def_opts, opt);
        if (nopts.href != "") {
            if (nopts.href.indexOf("?") < 0) {
                nopts.href += "?";
                nopts.href += "&winId=" + nopts.id;
            } else {
                if (nopts.href.indexOf("&winId") < 0 && nopts.href.indexOf("?winId") < 0) {
                    nopts.href += "&winId=" + nopts.id;
                }
            }
        }
        var head_cols = [];
        head_cols.push({ view: "label", label: nopts.title });
        if (nopts.maximize) {
            var _maximize_icon = "window-maximize";
            if (nopts.fullscreen) {
                _maximize_icon = "window-restore";
            }
            head_cols.push({
                view: "icon", icon: _maximize_icon,
                click: function () {
                    var obj = top.$$(nopts.id);
                    obj.config.fullscreen = !obj.config.fullscreen;
                    if (obj.config.fullscreen) {
                        this.define("icon", "window-restore")
                    } else {
                        this.define("icon", "window-maximize")
                    }
                    this.refresh();
                    obj.config.position = "center";
                    obj.resize();
                    obj.refresh();
                }
            });
        }
        if (nopts.close) {
            head_cols.push({
                view: "icon", icon: "times-circle",
                click: "$smd.win.close('" + nopts.id + "');"
            });
        }
        if (nopts.height == "max") {
            nopts.height = top.document.body.offsetHeight;
        }
        smdui.ui({
            view: "window",
            id: nopts.id,
            height: nopts.height, width: nopts.width,
            position: "center",
            move: nopts.move,
            modal: nopts.modal,
            resize: nopts.resize,
            fullscreen: nopts.fullscreen,
            head: {
                view: "toolbar", cols: head_cols,
            },
            body: {
                view: "iframe",
                borderless: true,
                src: nopts.href
            }
        }).show();
        var iframe = $$(nopts.id).getBody().getIframe();
        $(iframe).attr("id", nopts.id + "_iframe").attr("name", nopts.id + "_iframe");

        this.config[nopts.id] = { parentId: nopts.parentId, onclosed: nopts.onclosed };
    };
    obj.close = function (winid) {
        $smd.confirm("您将要关闭此页面，是否继续？", function (result) {
            //console.log(result);
            if (!result) return;
            obj._close(winid);
        });
    }
    obj._close = function (winid) {
        //console.log(winid);
        $$(winid).close();
        var opts = obj.config[winid];
        if (opts.onclosed != undefined) opts.onclosed();
        delete obj.config[winid];
    }
    obj.isExists = function (winid) {
        if (this.config[winid] != undefined) {
            return true;
        }
        return false;
    }
    return obj;
})();

/*
 *后台交互地址配置
 */
$smd.handlers = {
    "GetSingleItem": "/Platform/Ajax/Handler?method=GetSingleItem",
    "GetListItems": "/Platform/Ajax/Handler?method=GetListItems",
    "GetListItemsNoPage": "/Platform/Ajax/Handler?method=GetListItemsNoPage",
    "GetTreeList": "/Platform/Ajax/Handler?method=GetTreeList",
    "GetTreeListV3": "/Platform/Ajax/Handler?method=GetTreeListV3",
    "FormSubmit": "/Platform/Ajax/Handler?method=FormSubmit",
    "ComandSubmit": "/Platform/Ajax/Handler?method=ComandSubmit",
    "StrExplain": "/Platform/Ajax/Handler?method=StrExplain",
    "ProgramSubmit": "/Platform/Ajax/Handler?method=ProgramSubmit",
    "AlbumsUpLoad": "/Platform/Ajax/Handler?method=AlbumsUpLoad",
    "AlbumsDelete": "/Platform/Ajax/Handler?method=AlbumsDelete",
    "ImportChild": "/Platform/Ajax/Handler?method=ImportChildTable",
    "ExportToExcel": "/Platform/Ajax/Handler?method=ExportToExcel",
    "ExportToTemplateExcel": "/Platform/Ajax/Handler?method=ExportToTemplateExcel"
}

$smd.post = function (url, p, callback, async) {
    var reqAsync = true;//默认异步执行
    if (async != undefined && !async) reqAsync = false;
    $.ajax({
        "type": "post",
        "url": url,
        "data": p,
        "success": callback,
        "dataType": "json",
        "async": reqAsync,
        "error": function (XMLHttpRequest, textStatus, errorThrown) {
            $smd.alert('状态：' + textStatus + '；出错提示：' + errorThrown);
            //alert(url + "\n" + JSON.stringify(p));
        }
    });
}
$smd.get = function (url, callback, async) {
    var reqAsync = true;//默认异步执行
    if (async != undefined && !async) reqAsync = false;
    $.ajax({
        "type": "get",
        "url": url,
        "success": callback,
        "dataType": "json",
        "async": reqAsync,
        "error": function (XMLHttpRequest, textStatus, errorThrown) {
            $smd.alert('状态：' + textStatus + '；出错提示：' + errorThrown);
            //alert(url);
        }
    });
}


/*
 *默认参数
 */
if (typeof (smdsoft_pagesize) == "undefined") {
    smdsoft_pagesize = 15; 
}

/*
 *列表,单据表单公用方法
 */
$smd.listform = function (view) {
    if (typeof (view) == "string") {
        this.config.rootId = view;
    } else {
        this.config.rootId = view.id;
    }

    var that = this;
    this._cache = {};
    this.isLoading = false;
    this._naviSort = [];

    /*
     *常用方法
    */
    this.showProgress = function () {
        var topobj = smdui.$$(that.config.rootId);
        topobj.disable();
        topobj.showProgress({
            type: "icon",
            delay: 2000
        });
    }
    this.hideProgress = function () {
        var topobj = smdui.$$(that.config.rootId);
        topobj.enable();
        topobj.hideProgress();
    }
    this.formobj = function () {
        if (that._cache["formobj"] != undefined) {
            return that._cache["formobj"]
        } else {
            that._cache["formobj"] = smdui.$$(that.config.form.container);
            return that._cache["formobj"]
        }
    }
    this.elements = function (name) {
        var obj = that.formobj();
        return obj.elements[name];
    }
    this.setValue = function (name, value) {
        var obj = that.elements(name);
        obj.setValue(value);
    }
    this.getValue = function (name) {
        var obj = that.elements(name);
        return obj.getValue();
    }
    this.getElement = function (name) {
        if (typeof (name) == "string") {
            var view = that.elements(name);
            if (view == undefined) {
                var uid = that.getIdByName(name);
                view = that.$$(uid);
            }
            if (view == undefined) {
                return null;
            }
            return view;
        }
        if (typeof (name) == "object") {
            var ele = name;
            var view = that.elements(ele.name);
            if (view == undefined) {
                var uid = ele.id;
                view = that.$$(uid);
            }
            if (view == undefined) {
                return null;
            }
            return view;
        }
        return null;
    }
    this.getIdByName = function (name) {
        var uid = null;
        var newarr = that.config.form.elements.concat(that.config.form.list);
        for (var i = 0; i < newarr.length; i++) {
            var t = newarr[i];
            if (t.name == name) {
                uid = t.id;
                break;
            }
        }
        return uid;
    }
    this.getFormContainerId = function (rootview) {
        var containerid = null;
        if (rootview.config.view == "form") {
            containerid = rootview.config.id;
        } else {
            var childs = rootview.getChildViews();
            if (childs.length > 0) {
                for (var n in childs) {
                    var view = childs[n];
                    containerid = that.getFormContainerId(view);
                    if (containerid != null) {
                        break;
                    }
                }
            }
        }
        return containerid;
    }
    this.setValues = function (item) {
        for (var n in item) {
            that.setValue(n, item[n]);
        }
    }

    //表单容器初始化
    //this._viewFormContainerInit = function () {
    //    if (that.config.form.container == "") {
    //        for (var n in smdui.ui.views) {
    //            var sview = smdui.ui.views[n];
    //            if (sview.config.view == "form") {
    //                that.config.form.container = n;
    //                that.config.form.dataSource = $.extend(true, that.config.default.dataSource, sview.config.smdDataSource);
    //                if (that.config.default.smdform != undefined) {
    //                    that.config.form.smdform = $.extend(true, that.config.default.smdform, sview.config.smdform);
    //                }
    //                //alert(JSON.stringify(that.config.form.dataSource));
    //                break;
    //            }
    //        }
    //    }
    //}
    this._viewFormContainerInit = function () {
        if (that.config.form.container == "") {
            that.config.form.container = that.getFormContainerId(smdui.$$(that.config.rootId))
            var sview = smdui.$$(that.config.form.container);
            that.config.form.dataSource = $.extend(true, that.config.default.dataSource, sview.config.smdDataSource);
            if (that.config.default.smdform != undefined) {
                that.config.form.smdform = $.extend(true, that.config.default.smdform, sview.config.smdform);
            }
        }
    }
    //表单元素初始化
    this._viewFormElementInit = function () {
        var myform = smdui.$$(that.config.form.container);
        for (var n in myform.elements) {
            var sview = myform.elements[n];
            if (sview.config.name != undefined) {
                if (sview.config.view == "datatable") {
                    that.config.form.list.push({ id: sview.config.id, name: sview.config.name });
                } else {
                    that.config.form.elements.push({ id: sview.config.id, name: sview.config.name });
                }
            }
        }
        //表单之外元素
        for (var n in smdui.ui.views) {
            var sview = smdui.ui.views[n];
            if (sview.config.name != undefined && sview.config.refform != undefined) {
                if (sview.config.refform == that.config.rootId) {
                    if (sview.config.view == "datatable") {
                        that.config.form.list.push({ id: sview.config.id, name: sview.config.name });
                    } else {
                        that.config.form.elements.push({ id: sview.config.id, name: sview.config.name });
                    }
                }
            }
        }
    }
    //下拉列表初始化
    this._ddlOptionsInit = function () {
        var myform = smdui.$$(that.config.form.container);
        for (var n in that.config.form.elements) {
            var ele = that.config.form.elements[n];
            var sview = that.getElement(ele);
            if (sview.config.smdDataSource != undefined) {
                var _p = $.extend({ submitype: "xml", selectid: "", module: "", serverurl: "", request: [] }, sview.config.smdDataSource);
                var urls = $smd.handlers.GetListItems;
                if (_p.submitype != "xml") {
                    urls = _p.serverurl;
                } else {
                    if (_p.module == "") {
                        _p.module = that.config.form.dataSource.module;
                    }
                }
                $smd.post(urls, _p, function (ret) {
                    //alert(JSON.stringify(ret));
                    if (ret.status == 1) {
                        sview.define("options", ret.data.items);
                        sview.refresh();
                    }
                }, false);
            }
        }
        for (var n in that.config.form.list) {
            var ele = that.config.form.list[n];
            var sview = that.getElement(ele);
            var flag = false;
            for (var i in sview.config.columns) {
                var _col = sview.config.columns[i];
                if (_col.smdDataSource != undefined) {
                    var _p = $.extend({ submitype: "xml", "selectid": "", "module": "", serverurl: "", request: [] }, _col.smdDataSource);
                    var urls = $smd.handlers.GetListItems;
                    if (_p.submitype != "xml") {
                        urls = _p.serverurl;
                    } else {
                        if (_p.module == "") {
                            _p.module = that.config.form.dataSource.module;
                        }
                    }
                    $smd.post(urls, _p, function (ret) {
                        //alert(JSON.stringify(ret));
                        if (ret.status == 1) {
                            _col.collection = ret.data.items;
                            //if (_col.editor == undefined) {//不可编辑状态下，刷新；编辑状态下，执行空id 会被重新赋值
                               
                            //}
                            flag = true;
                        }
                    }, false);
                }
            }
            if (flag) {
                sview.refreshColumns();
            }
        }
    }
    //是否系统保留关键词
    this._isSysReservedWord = function (str) {
        if (str.indexOf("$smd") >= 0) {
            return true;
        }
        return false;
    }
    //元素是否可编辑
    this._viewCanFcous = function (view) {
        if (view == undefined) {
            return false;
        }
        if (!!view.config.disabled) {
            return false;
        } else if (!!view.config.hidden) {
            return false;
        } else if (view.config.editable != undefined && !!!view.config.editable) {
            return false;
        } else if (view.config.view == "datepicker") {
            return false;
        }
        return true;
    }

    //主表单公式触发
    this._trigerCellMath = function (name) {
        if (that.isLoading) return;

        var formobj = that.formobj();
        var math = formobj.config.math || [];
        for (var i = 0; i < math.length; i++) {
            var item = math[i];
            var fields = item["fields"];
            if (fields == undefined || fields == "") continue;
            fields += ",";
            if (fields.indexOf(name + ",") >= 0) {
                var condtion = item["condtion"];
                if (condtion != "") {
                    var ret2 = that.math.calculate(condtion);
                    if (ret2.status == 0) continue;
                    if (ret2.value != true && ret2.value != "true") continue;
                }

                var ret = that.math.calculate(item["str"]);
                if (ret.status == 1) {
                    that.elements(item.name).setValue(ret.value);
                }
            }
        }
    }
    //子表公式触发
    this._trigerGridMath = function (mygrid, rowid, colid) {
        debugger;
        var arr = mygrid.config.math || [];
        for (var i = 0; i < arr.length; i++) {
            var item = arr[i];
            var fields = item["fields"];
            if (fields == undefined || fields == "") continue;
            fields += ",";
            if (fields.indexOf(colid + ",") >= 0) {
                var str = item["str"];
                var condtion = item["condtion"];
                if (condtion != "") {
                    condtion = condtion.replace(/\$r/g, rowid);
                    condtion = condtion.replace(/\$c/g, colid);

                    var ret2 = that.math.grid_calculate(mygrid, condtion);
                    if (ret2.status == 0) continue;
                    if (ret2.value != true && ret2.value != "true") continue;
                }
                //必须替换当前编辑的行,列;以防鼠标切换其他行列
                str = str.replace(/\$r/g, rowid);
                str = str.replace(/\$c/g, colid);
                var ret = that.math.grid_calculate(mygrid, str);
                if (ret.status == 1) {
                    var data = {};
                    data[item.name] = ret.value;
                    mygrid.updateItem(rowid, data);
                }
            }
        }
    }
    //表单公式初始化
    this._mathEventInit = function () {
        var formobj = that.formobj();
        if (formobj.config.math != undefined) {
            var chufafield = {};
            var math = formobj.config.math || [];
            for (var i = 0; i < math.length; i++) {
                var item = math[i];
                var fields = item["fields"];
                if (fields == undefined || fields == "") continue;
                var arr = fields.split(",");
                for (var k = 0; k < arr.length; k++) {
                    var cfname = arr[k];
                    if (chufafield[cfname] == undefined) {
                        chufafield[cfname] = 1;
                    }
                }
            }
            for (var n in chufafield) {
                var view = that.getElement(n);
                if (!that._viewCanFcous(view)) continue;
                if (view.attachEvent == undefined) continue;
                //view.attachEvent("onChange", function (newv, oldv) {
                //    var name = this.config.name;
                //    that._trigerCellMath(name);
                //});
                view.attachEvent("onBlur", function (prev_view) {
                    var name = this.config.name;
                    that._trigerCellMath(name);
                });
            }
        }
        for (var n in that.config.form.list) {
            var ele = that.config.form.list[n];
            var view = smdui.$$(ele.id);
            if (view.config.math == undefined) continue;
            if (view.attachEvent == undefined) continue;
            view.attachEvent("onAfterEditStop", function (state, editor, ignoreUpdate) {
                var mygrid = this;
                if (state.value != state.old) {
                    that._trigerGridMath(mygrid, editor.row, editor.column);
                }
            });
        }
    }

    //表单元素导航初始化
    this._naviEventInit = function () {
        function selectNextCell(ele) {
            var view = _selectBeforeNextCell(ele, 1)
            if (view != null) {
                $smd.focusAtEnd(view.getInputNode());
                view.focus();
            }
        }
        function selectBeforeCell(ele) {
            var view = _selectBeforeNextCell(ele, -1)
            if (view != null) {
                $smd.focusAtEnd(view.getInputNode());
                view.focus();
            }
        }
        function selectRowLasterCell(row) {
            var rowobj = _getSortRow(row);
            if (rowobj == null) { return null; }
            var colobj = rowobj.col;
            var cell = colobj[colobj.length - 1];
            var view = that.getElement(cell.name);;
            if (!that._viewCanFcous(view)) {
                return _selectBeforeNextCell(view, -1);
            } else {
                return view;
            }
        }
        function selectRowFirstCell(row) {
            var rowobj = _getSortRow(row);
            if (rowobj == null) { return null; }
            var colobj = rowobj.col;
            var cell = colobj[0];
            var view = that.getElement(cell.name);;
            if (!that._viewCanFcous(view)) {
                return _selectBeforeNextCell(view, 1);
            } else {
                return view;
            }
        }
        function _selectBeforeNextCell(ele, k) {
            var p = $.extend({}, { ind: "" }, ele.config);
            if (p.ind == "") {
                return null;
            }
            var arr = p.ind.split(",");
            var row = parseInt(arr[0]), col = parseInt(arr[1]);
            var rowobj = _getSortRow(row);
            if (rowobj == null) { return null; }
            var colobj = rowobj.col;
            var cur_col_at = -1;
            for (var i = 0; i < colobj.length; i++){
                if (colobj[i].col == col) {
                    cur_col_at = i;
                    break;
                }
            }
            if (cur_col_at == -1) {
                return null;
            }
            var new_col_at = cur_col_at + k;
            if (new_col_at < 0) {//往左,上一行
                return selectRowLasterCell(row - 1);
            }
            if (new_col_at == colobj.length) {//往右，下一行
                return selectRowFirstCell(row + 1);
            }
            var cell = colobj[new_col_at];
            var view = that.getElement(cell.name);;
            if (!that._viewCanFcous(view)) {
                return _selectBeforeNextCell(view, k);
            } else {
                return view;
            }
        }
        function _getSortRow(row) {
            var t = null;
            for (var i = 0; i < that._naviSort.length; i++){
                if (that._naviSort[i].row == row) {
                    t = that._naviSort[i];
                    break;
                }
            }
            return t;
        }
        function _naviSortInit() {
            for (var i = 0; i < that.config.form.elements.length; i++) {
                var ele = that.config.form.elements[i];
                var myview = that.getElement(ele.name);
                if (myview == null) continue;
                if (typeof (myview.config.ind) == "undefined") continue;
                var arr = myview.config.ind.split(",");//"row,col"
                var row = arr[0], col = arr[1];
                var rowobj = _getSortRow(row);
                if (rowobj == null) {
                    rowobj = { row: row, col: [] };
                    that._naviSort.push(rowobj);
                    that._naviSort.sort(function (a, b) {//由小到大排序
                        return a.row - b.row;
                    });
                }
                var colobj = rowobj.col;
                colobj.push({ col: col, name: ele.name });
                colobj.sort(function (a, b) {//由小到大排序
                    return a.col - b.col;
                });
            }
        }

        var formobj = that.formobj();
        if (formobj.config.smdNavigation) {//启用导航
            _naviSortInit();
            for (var n = 0; n < that.config.form.elements.length; n++) {
                var ele = that.config.form.elements[n];
                var view = smdui.$$(ele.id);
                if (!that._viewCanFcous(view)) continue;
                if (view.attachEvent == undefined) continue;
                view.attachEvent("onKeyPress", function (code, e) {
                    if (code != 37 && code != 39 && code != 13) return;
                    var name = this.config.name;
                    var myview = that.getElement(name);
                    if (myview == null) return;
                    var node = myview.getInputNode();
                    var len = myview.getText != undefined ? myview.getText().toString().length : myview.getValue().toString().length;
                    var gbl = $smd.getCursortPosition(node);
                    if (len > gbl && (code == 39 || code == 13)) {
                        e.cancelBubble = true;
                    } else if (gbl > 0 && code == 37) {
                        e.cancelBubble = true;
                        //e.stopPropagation();
                    } else {
                        if (code == 37) selectBeforeCell(myview); //向左
                        if (code == 39) selectNextCell(myview); //向右
                        if (code == 13) {//回车
                            if (view.config.popup != undefined && view.config.popup != "") {
                                var popobj = smdui.$$(view.config.popup);
                                if (!popobj.isVisible()) {
                                    selectNextCell(myview); //向右
                                }
                            } else {
                                selectNextCell(myview); //向右
                            }
                        }
                    }
                });
            }
        }
    }

    this.event = {};
    this.event._setDefVal = function () {//新增设置默认值
        var arr = [];
        for (var n in that.config.form.elements) {
            var ele = that.config.form.elements[n];
            var sview = smdui.$$(ele.id);
            var item = sview.config;
            if (item.defval != undefined && item.defval != "") {
                arr.push({ name: item.name, temp: item.defval, value: "", type: item.defvaltype });
            }
        }
        if (arr.length == 0) return;
        var urls = $smd.handlers.StrExplain;
        $smd.post(urls, { strs: JSON.stringify(arr) }, function (ret) {
            //alert(JSON.stringify(ret));
            if (ret.status == 1) {
                var data = ret.data;
                var myform = smdui.$$(that.config.form.container);
                for (var i = 0; i < data.length; i++) {
                    var item = data[i];
                    myform.elements[item.name].setValue(item.value);
                }
            } else {
                $smd.alert(ret.msg);
            }
        }, false);
    }

    this.math = (function () {
        var obj = {};
        var ret = {};
        var mygrid = null;

        function _split_by(value, splitter) {
            var pos = value.indexOf(splitter);
            var before = value.substr(0, pos);
            var after = value.substr(pos + splitter.length);
            return [before, after];
        }
        function _reSetOut() {
            ret = {
                status: 1,
                msg: "",
                value: ""
            };
        }

        obj.get_operations = function (value) {
            // gettings operations list (+-*/)
            //var splitter = /(\+|\-|\*|\/)/g;
            var splitter = /(\+|\-|\*|\/|\==|\>|\<|\>=|\<=)/g;
            var operations = value.replace(/\[[^)]*?\]/g, "").match(splitter);
            return operations;
        }
        obj.get_refs = function (value) {
            //var reg = /\[([^\]]+),([^\]]+)\]/g;
            var reg = /(\[[^\[,\]]*\])|(\[([^\]]+),([^\]]+)\])/g
            var cells = value.match(reg);
            if (cells === null) cells = [];

            for (var i = 0; i < cells.length; i++) {
                var cell = cells[i];
                //cell = cell.substr(1, cell.length - 2);
                cell = $smd.trim(cell);
                cells[i] = cell;
            }
            return cells;
        }
        obj.get_calc_value = function (cell, clean) {
            cell = cell.substr(1, cell.length - 2);
            if (cell.indexOf(',') < 0) {//主表
                var obj = that.elements(cell);
                if (obj == undefined) {
                    return '#' + cell + '元素不存在！';
                }
                var value = obj.getValue();
                if (!clean) {//计算公式
                    value = value || 0;
                }
                return value;
            } else {//子表
                var item;
                var tp = cell;
                var arr = tp.split(',');
                var rowId, colId;
                if (arr.length == 2) {
                    rowId = arr[0];
                    colId = arr[1];
                }

                if (rowId.substr(0, 1) === ':')
                    rowId = mygrid.getIdByIndex(rowId.substr(1));
                if (colId.substr(0, 1) === ':')
                    colId = mygrid.columnId(colId.substr(1));
                if (rowId == "$r") {
                    item = mygrid.getSelectedItem();
                } else {
                    item = mygrid.getItem(rowId);
                }

                if (item == null)
                    return '#请选择有效的行！';

                var value = item[colId];
                if (!clean) {//计算公式
                    value = value || 0;
                }
                return value;
            }
        }
        obj.replace_refs = function (value, cells, clean) {
            var dell = "(", delr = ")";
            if (clean) dell = delr = "";
            for (var i = 0; i < cells.length; i++) {
                var cell = cells[i];
                var cell_value = this.get_calc_value(cell, clean);
                if (isNaN(cell_value) && !clean)
                    cell_value = '"' + cell_value + '"';
                value = value.replace(cell, dell + cell_value + delr);
            }
            return value;
        }
        obj.parse_args = function (value, operations) {
            var args = [];
            for (var i = 0; i < operations.length; i++) {
                var op = operations[i];
                var temp = _split_by(value, op);
                args.push(temp[0]);
                value = temp[1];
            }
            args.push(value);

            //var reg = /^(-?\d|\.|\(|\))+$/;
            for (var i = 0; i < args.length; i++) {
                var arg = $smd.trim(args[i]);
                //	if (reg.test(arg) === false)
                //		return ''; //error
                args[i] = arg;
            }

            var expr = "";
            for (var i = 0; i < args.length - 1; i++) {
                expr += args[i] + operations[i];
            }
            expr += args[args.length - 1];
            return expr;
        }
        obj.math_exception = function (value) {
            var reg = /#((\w+)|([\u4e00-\u9fa5]+))+/;
            var match = value.match(reg);
            if (match !== null && match.length > 0) {
                ret.status = 0;
                ret.msg = match[0];
                return true;
            }
            return false;
        }
        obj.compute = function (expr) {
            try {
                smdui.temp_value = '';
                expr = 'smdui.temp_value = ' + expr;
                eval(expr);
            } catch (ex) {
                ret.status = 0;
                ret.msg = "公式计算发送错误";
                console.log("公式计算发送错误：" + expr);
                smdui.temp_value = '';
            }
            var result = smdui.temp_value;

            smdui.temp_value = null;
            return result.toString();
        }
        obj.calculate = function (_math, isgs) {
            //debugger;
            _reSetOut();
            var value = _math;
            var operations = this.get_operations(value);
            var triggers = this.get_refs(value);
            isgs = isgs || true;

            if (operations && isgs) {
                value = this.replace_refs(value, triggers);
                value = this.parse_args(value, operations);
            } else {
                value = this.replace_refs(value, triggers, true);
                var triggers = [];
            }

            var exc = this.math_exception(value);
            if (exc) {
                return ret;
            }

            // there aren't any operations here. returns number or value of another cell
            if (!value) {
                ret.value = value;
                return ret;
            }

            // process mathematical expression and getting final result
            if (operations && isgs) {
                value = this.compute(value);
            }
            if (ret.status == 1) {
                ret.value = value;
            }
            return ret;
        }
        obj.grid_calculate = function (name, _math, isgs) {
            obj.set_grid(name);
            return obj.calculate(_math, isgs);
        }
        obj.set_grid = function (name) {
            if (typeof (name) == "string") {
                mygrid = that.elements(name);
            } else {
                mygrid = name;
            }
        }
        return obj;
    })(window);
    this.getReqVal = function (value) {
        var ret = {
            status: 1,
            msg: "",
            value: ""
        };
        if (typeof (value) == "string") {
            if (that._isSysReservedWord(value)) {
                switch (value) {
                    case "$smd.keyword":
                        ret.value = that.getKeyValue();
                        break;
                    default:
                        ret.status = 0;
                        ret.msg = "未定义的系统关键字";
                        break;
                }
            }  else {
                ret = that.math.calculate(value, false);
            }
        } else {
            ret.value = value;
        }
        return ret;
    }
    this.getReqVal2 = function (value) {
        var ret = that.getReqVal(value);
        if (ret.status == 1) {
            return ret.value;
        } else {
            return "";
        }
    }
    this.getReqData = function (data) {
        var newdata = {};
        for (var d in data) {
            newdata[d] = that.getReqVal2(data[d]);
        }
        return newdata;
    }
    this.trigerCellMath = this._trigerCellMath;
    this.$$ = function (id) {
        return smdui.$$(id);
    }
}
/*
 *列表相关方法
 */
$smd.listui = function (view) {
    this.config = {
        rootId: "",
        form: {
            container: "",
            smdform: {},
            dataSource: {},
            elements: [],
            list: [],
            dbclick: true
        },
        default: {
            dataSource: {
                module: "", select: { selecttype: "xml", selectid: "", serverurl: "", autoload: true }, keycol:"",paging: false, pager: {
                    size: smdsoft_pagesize,
                    group: 8
                }
            },
            smdform: { url: "", openway: 3, title: "", height: 0, width: 0, fullscreen: false, maximize: false, refreshOwner: true },
        }
    };

    var that = this;
    $smd.listform.apply(this, [view]);

    this.clearRequest = function () {
        for (var n in that.config.form.elements) {
            var ele = that.config.form.elements[n];
            var sview = smdui.$$(ele.id);
            sview.setValue("");
        }
    }
    this.defaultGrid = function () {
        var ele = that.config.form.list[0];
        var grid = smdui.$$(ele.id);
        return grid;
    }
    this.event.load = function () {
        var dss = that.config.form.dataSource;
        var ele = that.config.form.list[0];
        var grid = smdui.$$(ele.id);
        if (dss.paging) {
            that.event._loadPager(grid,0);
        } else{
            that.event._load(grid);
        }
        
    }
    this.event.add = function () {
        that.event._add();
    }
    this.event.edit = function () {
        var grid = that.defaultGrid();
        var item = grid.getSelectedItem();
        if (item == null) {
            $smd.errorTips("选择你要编辑的行！");
            return;
        }
        var dss = that.config.form.dataSource;
        var key = item[dss.keycol];
        that.event._edit(key);
    }

    this.event._load = function (grid) {
        var ret = {
            status: 1,
            msg: ""
        };
        var pindex = 1;
        function _getParams() {
            var dss = that.config.form.dataSource;
            var pa = {};
            if (dss.select.selecttype == "xml") {
                pa.module = dss.module;
                pa.selectid = dss.select.selectid;
            }
            for (var n in that.config.form.elements) {
                var ele = that.config.form.elements[n];
                var sview = smdui.$$(ele.id);
                pa[ele.name] = sview.getValue();
            }
            if (grid.config.paging) {
                pa.pageIndex = 1;
                pa.size = smdsoft_pagesize;
            }
            return pa;
        }

        var p = _getParams();
        //alert(JSON.stringify(p));
        if (p == null) return;

        var urls = $smd.handlers.GetListItems;
        that.showProgress();
        $smd.post(urls, p, function (ret) {
            //alert(JSON.stringify(ret));
            that.hideProgress();
            if (ret.status == 1) {
                var ele = that.config.form.list[0];
                var gird = smdui.$$(ele.id);
                gird.clearAll();
                gird.parse(ret.data.items, "json");

                //表尾
                if (ret.data.fitems.length > 0) {
                    //alert(JSON.stringify(ret.data.fitems));
                    var colums = gird.config.columns;
                    for (var n = 0; n < ret.data.fitems.length; n++) {
                        var t = ret.data.fitems[n];
                        for (var a in t) {
                            for (var m = 0; m < colums.length; m++) {
                                if (colums[m].id == a) {
                                    if (colums[m].footer == undefined) colums[m].footer = [];
                                    if (colums[m].footer.length < n + 1)
                                        colums[m].footer.push({});
                                    colums[m].footer[n].text = t[a];
                                }
                            }
                        }
                    }
                    gird.refreshColumns();
                }
            } else {
                $smd.alert(ret.msg);
            }
        }, "json");
    }
    this.event._loadPager = function (grid, pindid) {
        var ret = {
            status: 1,
            msg: ""
        };
        var pindex = 1;
        var pager = smdui.$$(grid.config.pagingId);
        var size = pager.config.size;
        function _getParams() {
            var page = pager.config.page;//从零开始
            var pageCount = pager.config.pageCount;
            if (pindid == "next") {
                if (page + 1 == pageCount) {
                    ret.status = 0;
                    ret.msg = "已是最后一页！";
                    return null;
                }
                pindex = page + 1 +1;
            } else if (pindid == "last") {
                pindex = pageCount;
            } else if (pindid == "prev") {
                if (page+1== 1) {
                    ret.status = 0;
                    ret.msg = "已是第一页！";
                    return null;
                }
                pindex = page + 1 - 1;
            } else if (pindid == "first") {
                pindex = 1;
            } else if (pindid == "cur") {
                pindex = page + 1;
            } else {
                pindex = parseInt(pindid) + 1;
            }

            var dss = that.config.form.dataSource;
            var pa = { "pageIndex": pindex, "size": size};
            if (dss.select.selecttype == "xml") {
                pa.module = dss.module;
                pa.selectid = dss.select.selectid;
            }
            for (var n in that.config.form.elements) {
                var ele = that.config.form.elements[n];
                var sview = smdui.$$(ele.id);
                pa[ele.name] = sview.getValue();
            }
            if (grid.config.paging) {
                pa.pageIndex = 1;
                pa.size = smdsoft_pagesize;
            }
            return pa;
        }

        var p = _getParams();
        //alert(JSON.stringify(p));
        if (p == null) return;

        var urls = $smd.handlers.GetListItems;
        that.showProgress();
        $smd.post(urls, p, function (ret) {
            //alert(JSON.stringify(ret));
            that.hideProgress();
            if (ret.status == 1) {
                var ele = that.config.form.list[0];
                var gird = smdui.$$(ele.id);
                gird.clearAll();
                gird.parse(ret.data.items, "json");

                //表尾
                if (ret.data.fitems.length > 0) {
                    //alert(JSON.stringify(ret.data.fitems));
                    var colums = gird.config.columns;
                    for (var n = 0; n < ret.data.fitems.length; n++) {
                        var t = ret.data.fitems[n];
                        for (var a in t) {
                            for (var m = 0; m < colums.length; m++) {
                                if (colums[m].id == a) {
                                    if (colums[m].footer == undefined) colums[m].footer = [];
                                    if (colums[m].footer.length < n + 1)
                                        colums[m].footer.push({});
                                    colums[m].footer[n].text = t[a];
                                }
                            }
                        }
                    }
                    gird.refreshColumns();
                }
                var dss = that.config.form.dataSource;
                if (dss.paging) {
                    var pager = smdui.$$(grid.config.pagingId);
                    var pager_record = smdui.$$(grid.config.pagingRecordId);
                    var pageIndex = ret.data.pageIndex;
                    var pageSize = pager.config.size;
                    var recordCount = ret.data.recordCount;
                    var pageCount = parseInt(recordCount / pageSize);
                    if (recordCount % pageSize != 0) {
                        pageCount++;
                    }
                    pager_record.setValue("共" + recordCount + "条记录");
                    pager.define({ "page": pageIndex - 1, "count": recordCount, "pageCount": pageCount });
                    pager.refresh();
                }
            } else {
                $smd.alert(ret.msg);
            }
        }, "json");
    }
    this.event._add = function () {
        var formparam = that.config.form.smdform;
        var _myformurl = formparam.url;
        if (formparam.openway == 1) {//当前页面打开
            window.location.href = _myformurl + "?action=add";
        } else if (formparam.openway == 3) {//弹出窗口
            var parentId = $smd.urlParam("winId");
            var winId = parentId + "_formdj";
            top.$smd.win.open({
                id: winId,
                parentId: parentId,
                title: formparam.title + "-新增",
                href: _myformurl + "?action=add&winId=" + winId,
                width: formparam.width,
                height: formparam.height,
                fullscreen: formparam.fullscreen,
                maximize: formparam.maximize,
                onclosed: function () {
                    that.api();
                }
            });
        }
    }
    this.event._edit = function (id) {
        var formparam = that.config.form.smdform;
        var _myformurl = formparam.url;

        if (formparam.openway == 1) {//当前页面打开
            window.location.href = _myformurl + "?action=edit&id=" + id;
        } else if (formparam.openway == 3) {//弹出窗口
            var parentId = $smd.urlParam("winId");
            var winId = parentId + "_formdj";
            if (top.$smd.win.isExists(winId)) {//解决IE双击重复打开
                return;
            }
            var onclosedMethod = function () {
                that.api();
            };
            if (!formparam.refreshOwner) {
                onclosedMethod = null;
            }
            top.$smd.win.open({
                id: winId,
                parentId: parentId,
                title: formparam.title + "-编辑",
                href: _myformurl + "?action=edit&&id=" + id + "&winId=" + winId,
                width: formparam.width,
                height: formparam.height,
                fullscreen: formparam.fullscreen,
                maximize: formparam.maximize,
                onclosed: onclosedMethod
            });
        }
    }

    //后台分页初始化
    this._listTablePagerBarInit = function () {
        var dss = that.config.form.dataSource;
        if (dss.paging) {
            var grid = that.defaultGrid();
            var paging_id = "smdlist_paging" + (new Date()).valueOf();
            var paging_record_id = paging_id + "_total_record";
            var layout = grid.getParentView();
            var ind = layout.index(grid);
            layout.addView({
                cols: [
                    {
                        view: "select", label: "显示行数", options: [{ id: 10, value: 10 }, { id: 50, value: 50 }, { id: 100, value: 100 }, { id: 500, value: 500 }], labelWidth: 65, width: 116, value: smdsoft_pagesize, labelAlign: "right",
                        on: {
                            "onChange": function (newv, oldv) {
                                var grid = that.defaultGrid();
                                var pagingId = grid.config.pagingId;

                                smdui.$$(pagingId).define("size", newv);
                                that.event._loadPager(grid, "first");  
                            }
                        }
                    },
                    { view: "label", id: paging_record_id, width: 80, align: "center" },
                    {
                        view: "pager",
                        id: paging_id,
                        template: "{common.first()} {common.prev()} {common.pages()} {common.next()} {common.last()}",
                        size: dss.pager.size,
                        group: dss.pager.group,
                        count: 0,
                        pageCount: 0,
                        page:0,
                        on: {
                            "onItemClick": function (id, e, node) {
                                that.event._loadPager(that.defaultGrid(), id);  
                            }
                        }
                    },
                    {}
                ]
            }, ind + 1);
            grid.define({ "pagingId": paging_id, "pagingRecordId": paging_record_id });
        }
    }
    //表单双击事情初始化
    this._listTableDbClickInit = function () {
        var myconfig = that.config.form;
        var smdform = that.config.form.smdform;
        if (typeof (myconfig.dbclick) == "boolean" && myconfig.dbclick) {//开启双击事件
            if (smdform.url != "") {//配置表单地址，默认打开表单
                var grid = that.defaultGrid();
                grid.attachEvent("onItemDblClick", function (id, e, node) {
                    that.event.edit();
                    return true;
                });
            }
        }
    }

    this.api = function (param) {
        //alert("这是测试页面");
        var opts = $.extend({
            action: "reload"
        }, param);
        if (opts.action == "reload") {
            that.event.load();
        }
    }
    this.init = function () {
        smdui.ui(view);
        if (that.config.rootId != "") {
            smdui.extend($$(that.config.rootId), smdui.ProgressBar);
        }
        that._viewFormContainerInit();
        that._viewFormElementInit();
        that._listTablePagerBarInit();
        that._listTableDbClickInit();
        that._ddlOptionsInit();
        that.event._setDefVal();
        if (that.config.form.dataSource.select.autoload) {
            that.event.load();
        }
    }

    this.init();
}

/*
 *表单相关方法
 */
$smd.formui = function (view) {
    this.config = {
        rootId: "",
        form: {
            container: "",
            keyval: "",
            elements: [],
            list: [],
            dataSource: {}
        },
        default: {
            dataSource: { module: "", key: "", returl: "", save: { submittype: "xml", submitid: "", serverurl: "" }, select: { selecttype: "xml", selectid: "", serverurl: "", request: {}, autoload: true } },
            childDataSource: { module: "", key: "", glkey: "", select: { selecttype: "xml", selectid: "", serverurl: "", request: {},  async: true }, unsave: false },
            ddlDataSource: { submitype: "xml", selectid: "", module: "", serverurl: "", request: {} }
        }
    };
    var that = this;
    $smd.listform.apply(this, [view]);

    /*
   *子表删除临时数据
   */
    this.delListRow = {
    }

    /*
     *常用方法
     */
    this.setKeyValue = function (v) {
        that.config.form.keyval = v;
    }
    this.getKeyValue = function () {
        return that.config.form.keyval;
    }
    this.setHeaderValues = function (item) {
        for (var n in that.config.form.elements) {
            var ele = that.config.form.elements[n];
            if (item[ele.name] == undefined) continue;
            var sview = smdui.$$(ele.id);
            sview.setValue(item[ele.name]);
        }
    }

    //加载数据
    this.event.loadPage = function () {
        that.event.load();
    }
    this.event.load = function () {
        var keyvalue = that.getKeyValue();
        if (keyvalue != "") {
            var selectobj = that.config.form.dataSource.select;
            selectobj.data = {};
            selectobj.data[that.config.form.dataSource.key] = keyvalue;
            that.event._load(selectobj);
        } else {
            $smd.errorTips("无效的关键字！");
        }
    }
    this.event.loadChildList = function (name) {
        var sview = that.getElement(name);
        if (sview == null) return;
        if (sview.config.smdDataSource == undefined) return;
        var dds = $.extend(true, that.config.default.childDataSource, sview.config.smdDataSource);
        if (dds.select.selecttype == "xml" && dds.select.selectid == "") return;
        that.event._loadChildList(sview, dds);
    }
    this.event.add = function () {
        that.event._add();
        that.event._setDefVal();

        setTimeout(function () {
            that.formobj().callEvent("onSmdAfterAdd", [that]);
        }, 100);//延迟，确保表单初始化完成
    }
    this.event.save = function () {
        var saveparam = that.config.form.dataSource.save;
        that.event._save(saveparam);
    }
    this.event.close = function () {
        $smd.confirm("您将要关闭此页面，是否继续？", function (result) {
            if (!result) return;
            that.event._close();
        });
    }

    this.event._load = function (selparam, callback) {
        //alert(JSON.stringify(selparam));
        var urls = $smd.handlers.GetSingleItem;
        var pdata = selparam.data;
        if (selparam.selecttype == "xml") {
            pdata.selectid = selparam.selectid;
            pdata.module = that.config.form.dataSource.module;
        } else if (selparam.selecttype == "ajax") {
            urls = selparam.serverurl;
        }
        that.isLoading = true;
        $smd.post(urls, pdata, function (ret) {
            //alert(JSON.stringify(ret));
            if (ret.status == 1) {
                var myform = that.formobj();
                var item = ret.data.item;
                for (var n in that.config.form.elements) {
                    var ele = that.config.form.elements[n];
                    if (item[ele.name] == undefined) continue;
                    var sview = myform.elements[ele.name];
                    sview.setValue(item[ele.name]);
                }
                for (var n in that.config.form.list) {
                    var ele = that.config.form.list[n];
                    if (item[ele.name] == undefined) continue;
                    var sview = myform.elements[ele.name];
                    sview.clearAll();
                    var arritems = item[ele.name];
                    if (arritems.length == 0) {
                        arritems = that.event._getDefaultRows(sview);
                    }
                    sview.parse(arritems, "json");
                }
                //主表返回数据后，查询
                for (var n in that.config.form.list) {
                    var ele = that.config.form.list[n];
                    var sview = that.getElement(ele);
                    if (sview == null) continue;
                    if (sview.config.smdDataSource == undefined) continue;
                    var dds = $.extend(true, that.config.default.childDataSource, sview.config.smdDataSource);
                    if (dds.select.selecttype == "xml" && dds.select.selectid == "") continue;
                    that.event._loadChildList(sview, dds);
                }

                setTimeout(function () {
                    myform.callEvent("onSmdAfterLoad", [that, ret]);
                }, 100)
            } else {
                $smd.errorTipsShow(ret.msg);
            }
            if (typeof (callback) == "function") {
                callback();
            }
            that.isLoading = false;
        }, false);
    }
    this.event._loadChildList = function (sview, dds) {
        var urls = $smd.handlers.GetListItems;
        //var dds = $.extend(true, that.config.default.childDataSource, sview.config.smdDataSource);
        var pdata = that.getReqData(dds.select.request);
        if (dds.glkey != "") {
            pdata[dds.glkey] = that.getKeyValue();
        }
        if (dds.select.selecttype == "xml") {
            pdata.selectid = dds.select.selectid;
            pdata.module = that.config.form.dataSource.module;
        } else if (dds.select.selecttype == "ajax") {
            urls = dds.select.serverurl;
        }
        var _async = dds.select.async;
        $smd.post(urls, pdata, function (ret) {
            //alert(JSON.stringify(ret));
            if (ret.status == 1) {
                sview.clearAll();
                var arritems = ret.data.items;

                var count = sview.config.editDefaultRow == undefined ? 5 : sview.config.editDefaultRow;
                if (arritems.length < count) {
                    var bankarray = that.event._getDefaultCountRows(sview, count - arritems.length);
                    arritems = arritems.concat(bankarray);
                }

                sview.parse(arritems, "json");

                var gridname = sview.config.name;
                if (gridname != undefined && that.delListRow[gridname] != undefined) {
                    that.delListRow[gridname] = [];//清楚待删除子表数据
                }

            } else {
                $smd.errorTipsShow(ret.msg);
            }
        }, _async);
    }
    this.event._add = function () {
        that.setKeyValue("");
        var myform = smdui.$$(that.config.form.container);
        for (var n in that.config.form.elements) {
            var name = that.config.form.elements[n].name;
            var sview = myform.elements[name];
            var item = sview.config;
            if (item.addkeep != undefined && item.addkeep) continue;
            sview.setValue("");
        }
        for (var n in that.config.form.list) {
            var ele = that.config.form.list[n];
            var sview = myform.elements[ele.name];
            if (sview == undefined) {
                sview = smdui.$$(ele.id);
            }
            sview.clearAll();
            sview.parse(that.event._getDefaultRows(sview), "json");
        }
    }
    this.event._getDefaultRows = function (grid) {
        var count = grid.config.editDefaultRow == undefined ? 5 : grid.config.editDefaultRow;
        return that.event._getDefaultCountRows(grid, count);
    }
    this.event._getDefaultCountRows = function (grid, count) {
        var columns = grid.config.columns;
        var arr = [];
        for (var i = 0; i < count; i++) {
            var row = {};
            for (var k = 0; k < columns.length; k++) {
                var col = columns[k];
                row[col.id] = "";
            }
            //隐藏列
            for (var k in grid._hidden_column_hash) {
                var t = grid._hidden_column_hash[k];
                row[t.id] = "";
            }
            arr.push(row);
        }
        return arr;
    }
    this.event._save = function (saveparam) {
        function _checkGridItem(sitem, cols) {
            var f = false;
            for (var k = 0; k < cols.length; k++) {
                var i = cols[k];
                if (i.rowindex) continue;//序号不做参考
                if (i.unsave) continue; //不保存不做参考
                if (sitem[i.id] == undefined) continue;
                if (sitem[i.id] != "") {
                    f = true;
                    break;
                }
            }
            return f;
        }
        function _getGridSaveParams(gridobj) {
            gridobj.editStop();//停止编辑状态
            var count = gridobj.count();
            var cols = gridobj.config.columns;
            var listdata = [];
            for (var i = 0; i < count; i++) {
                var rowid = gridobj.getIdByIndex(i);
                var item = gridobj.getItem(rowid);
                var sitem = {};
                for (var k = 0; k < cols.length; k++) {
                    var t = cols[k];
                    if (t.unsave != undefined && t.unsave) continue;
                    sitem[t.id] = item[t.id];
                }
                //隐藏列
                for (var k in gridobj._hidden_column_hash){
                    var t = gridobj._hidden_column_hash[k];
                    if (t.unsave != undefined && t.unsave) continue;
                    sitem[t.id] = item[t.id];
                }
                if (_checkGridItem(sitem, cols)) {
                    listdata.push(sitem);
                }
            }
            return listdata;
        }
        function _getSaveParams() {
            var p = {};
            for (var n in that.config.form.elements) {
                var ele = that.config.form.elements[n];
                var sview = smdui.$$(ele.id);
                var i = sview.config;
                if (i.unsave != undefined && i.unsave) continue;
                p[ele.name] = sview.getValue();

                if (i.html != undefined && i.html) {
                    p[ele.name] = encodeURIComponent(p[ele.name]);
                }
            }
            if (p[that.config.form.dataSource.key] == undefined) {
                p[that.config.form.dataSource.key] = that.getKeyValue();
            }
            for (var n in that.config.form.list) {
                var ele = that.config.form.list[n];
                var sview = smdui.$$(ele.id);
                if (sview.config.unsave != undefined && sview.config.unsave) {
                    continue;
                }

                var arr = _getGridSaveParams(sview);
                if (saveparam.submittype == "xml") {
                    p[ele.name] = JSON.stringify(arr);
                } else {
                    p[ele.name] = arr;
                }

                //删除部分数据
                var sub_arr = [];
                var del_arr = that.delListRow[ele.name];
                for (var k = 0; k < del_arr.length; k++) {
                    var t = del_arr[k];
                    var item = {};
                    item[t.name] = t.value;
                    sub_arr.push(item);
                }
                if (saveparam.submittype == "xml") {
                    p["del_" + ele.name] = JSON.stringify(sub_arr);
                } else {
                    p["del_" + ele.name] = sub_arr;
                }
            }
            //alert(JSON.stringify(p));
            return p;
        }

        that.showProgress();
        var p = _getSaveParams();
        var urls = $smd.handlers.FormSubmit;

        if (saveparam.submittype == "program") {
            urls = $smd.handlers.ProgramSubmit;
        } else if (saveparam.submittype == "ajax") {
            urls = saveparam.serverurl;
            p = { body: JSON.stringify(p) };
        }
        //that.hideProgress();
        //return;
        $smd.post(urls, p, function (ret) {
            that.hideProgress();
            var formcommon = that.config.form.dataSource;
            if (ret.status <= 0) {
                $smd.alert(ret.msg);
            } else {
                //保存后事件
                if (that.formobj().callEvent("onSmdAfterSave", [that,ret]) === false) return false;

                if (formcommon.returl != "") {
                    $smd.tips(ret.msg, 2000);
                    if (formcommon.returl == "close") {
                        that.event._close();
                    } else {
                        window.location.href = formcommon.returl;
                    }
                } else {
                    $smd.tips(ret.msg, 2000);
                    if (ret.data != undefined && ret.data[formcommon.key] != undefined) {
                        that.setKeyValue(ret.data[formcommon.key]);
                        that.event.loadPage();
                    }
                }
            }
        }, "json");
    }
    this.event._close = function () {
        var winId = $smd.urlParam("winId");
        top.$smd.win._close(winId);
    }
    this.event._delChildItem = function (gridobj, rid) {
        var item = gridobj.getItem(rid);

        //删除前事件
        if (gridobj.callEvent("onSmdBeforeDelete", [gridobj.config.name, item]) === false) return false;

        var previd = gridobj.getPrevId(rid, 1);
        gridobj.remove(rid);
        if (previd != undefined) {
            gridobj.select(previd);
        }
        var gridsds = $.extend(true, that.config.default.childDataSource, gridobj.config.smdDataSource);
        var key = gridsds.key;
        var name = gridobj.config.name;
        if (key != undefined && name != undefined && item[key] != undefined) {
            if (that.delListRow[name] == undefined) that.delListRow[name] = [];
            that.delListRow[name].push({ name: key, value: item[key] });
        }

        //删除后事件
        gridobj.callEvent("onSmdAfterDelete", [gridobj.config.name, item]);
    }

    //工具栏及删除数据初始化
    this._listTableToolBarInit = function () {
        function lt_addRow() {
            var gridId = this.config.gridId;
            var gridobj = smdui.$$(gridId);
            var cn = gridobj.count();
            var row = that.event._getDefaultCountRows(gridobj, 1);
            gridobj.add(row[0], cn);
        }
        function lt_delRow() {
            var gridId = this.config.gridId;
            var gridobj = smdui.$$(gridId);

            var rid = gridobj.getSelectedId();
            if (rid == undefined) return;
            that.event._delChildItem(gridobj, rid);
        }

        for (var i = 0; i < that.config.form.list.length; i++) {
            var ele = that.config.form.list[i];
            var grid = smdui.$$(ele.id);
            var p = grid.config;
            if (p.toolbar) {
                var layout = grid.getParentView();
                var ind = layout.index(grid);
                layout.addView({
                    type: "wide",
                    cols: [
                        { width: 10 },
                        { view: "button", type: "icon", icon: "16_add", label: "追加行", width: 70, click: lt_addRow, gridId: p.id },
                        { view: "button", type: "icon", icon: "16_cancel", label: "删除行", width: 70, click: lt_delRow, gridId: p.id },
                        {}
                    ]
                }, ind + 1);
            }
            //初始化删除数组
            if (p.unsave == undefined || p.unsave == false) {
                that.delListRow[p.name] = [];
            }
        }
    }
    //合计关联单元格初始化
    this._listTableFooterToCellInit = function () {
        for (var i = 0; i < that.config.form.list.length; i++) {
            var ele = that.config.form.list[i];
            var grid = smdui.$$(ele.id);
            grid.attachEvent("onAfterSumColRef", function (id, value) {
                var colindex = this.getColumnIndex(id);
                if (colindex >= 0) {
                    var c = this.config.columns[colindex];
                    if (c.ftocell != undefined && c.ftocell != "") {
                        var cell = smdui.$$(that.config.form.container).elements[c.ftocell];
                        if (cell != undefined) {
                            cell.setValue(value);
                            that._trigerCellMath(c.ftocell);
                        }
                    }
                }
            });
        }
    }

    this.init = function () {
        if (typeof (view) == "object") {
            smdui.ui(view);
        }
        if (that.config.rootId != "") {
            smdui.extend($$(that.config.rootId), smdui.ProgressBar);
        }
        //if (_param.form.list.length > 0) {
        //    _param.form.curlist = _param.form.list[0].name;
        //}
        that._viewFormContainerInit(); 
        that._viewFormElementInit(); 
        that._listTableToolBarInit(); 
        that._listTableFooterToCellInit(); 
        that._ddlOptionsInit(); 
        that._mathEventInit(); 
        that._naviEventInit(); 

        var action = $smd.urlParam("action");
        if (action == "edit") {
            var kval = $smd.urlParam("id");
            if (kval != null) {
                that.setKeyValue(kval);
            }
            if (that.config.form.dataSource.select.autoload) {
                that.event.loadPage();
            }
        } else if (action == "add") {
            that.event.add();
        } else {
            if (that.config.form.dataSource.select.autoload) {
                that.event.loadPage();
            }
        }
    }

    this.init();
}

/*
 *通用导出excel,依赖smdui,Jquery
 */
$smd.toExcel = function (id, options) {
    var defer = smdui.promise.defer();
    var view = smdui.$$(id);
    options = options || { reload: 0, request: {} };

    if (view.$exportView)
        view = view.$exportView(options);

    function getExportScheme(view, options) {
        var scheme = [];
        var h_count = 0, f_count = 0;
        var isTable = view.getColumnConfig;
        var columns = options.columns;
        var raw = !!options.rawValues;


        if (!columns) {
            if (isTable) {
                columns = view._columns_pull;
                //columns = view.config.columns;
            }
            else {
                columns = smdui.copy(view.data.pull[view.data.order[0]]);
                for (var key in columns) columns[key] = true;
                delete columns.id;
            }
        }
        if (options.id)
            scheme.push({ id: "id", width: 50, header: " ", template: function (obj) { return obj.id; } });

        for (var key in columns) {
            var column = columns[key];
            if (column.noExport != undefined && column.noExport) continue;

            if (isTable && view._columns_pull[key])
                column = smdui.extend(smdui.extend({}, column), view._columns_pull[key]);

            var record = {
                id: column.id,
                template: ((raw ? null : column.template) || function (key) { return function (obj) { return obj[key]; }; }(key)),
                width: ((column.width || 200) * (options._export_mode === "excel" ? 8.43 / 70 : 1)),
                header: (column.header !== false ? (column.header || key) : "")
            };

            if (typeof record.header === "string") record.header = [{ text: record.header }];
            else record.header = smdui.copy(record.header);

            for (var i = 0; i < record.header.length; i++) {
                record.header[i] = record.header[i] ? (record.header[i].contentId ? "" : record.header[i].text) : "";
            }
            h_count = Math.max(h_count, record.header.length);

            if (view._settings.footer) {
                var footer = column.footer || "";
                if (typeof footer == "string") footer = [{ text: footer }];
                else footer = smdui.copy(footer);

                for (var i = 0; i < footer.length; i++) {
                    if (footer[i]) footer[i] = footer[i].contentId ? view.getHeaderContent(footer[i].contentId).getValue() : footer[i].text;
                    else footer[i] = "";
                }
                record.footer = footer;
                f_count = Math.max(f_count, record.footer.length);
            }
            scheme.push(record);
        }

        //normalize headers and footers
        for (var i = 0; i < scheme.length; i++) {

            var diff = h_count - scheme[i].header.length;
            for (var d = 0; d < diff; d++)
                scheme[i].header.push("");

            if (view._settings.footer) {
                diff = f_count - scheme[i].footer.length;
                for (var d = 0; d < diff; d++)
                    scheme[i].footer.push("");
            }
        }

        return scheme;
    }
    function getExportData(view, options, scheme) {
        var filterHTML = !!options.filterHTML;
        var htmlFilter = /<[^>]*>/gi;
        var data = [];
        var header, headers;
        if (options.header !== false && scheme.length && options._export_mode === "excel") {
            for (var h = 0; h < scheme[0].header.length; h++) {
                headers = [];
                for (var i = 0; i < scheme.length; i++) {
                    header = "";
                    if (scheme[i].header[h])
                        header = scheme[i].header[h];
                    if (filterHTML)
                        header = header.replace(htmlFilter, "");
                    headers.push(header);
                }
                data.push(headers);
            }
        }

        var isTree = (view.data.name == "TreeStore");

        for (var k = 0; k < view.data.length; k++) {
            var item = view.data[k];
            if (item) {
                var line = [];
                for (var i = 0; i < scheme.length; i++) {
                    var column = scheme[i];
                    var cell = item[column.id];
                    if (column.template != undefined) {
                        var tp_cell = column.template(item, view.type, item[column.id], column, i);
                        if (tp_cell != undefined) {
                            cell = tp_cell;
                        }
                    }
                    if (!cell && cell !== 0) cell = "";
                    if (filterHTML && typeof cell === "string") {
                        if (isTree)
                            cell = cell.replace(/<div class=.smdui_tree_none.><\/div>/, " - ");
                        cell = cell.replace(htmlFilter, "");
                    }
                    line.push(cell);
                }
                data.push(line);
            }
        }

        //此部分暂时注释，上面分页的数据已包含了footer
        var pager = options.pager == undefined ? false : options.pager;
        if (options.footer !== false && pager == false) {
            var f_count = scheme[0].footer ? scheme[0].footer.length : 0;
            for (var f = 0; f < f_count; f++) {
                var footers = [];
                for (var i = 0; i < scheme.length; i++) {
                    var footer = scheme[i].footer[f];
                    if (filterHTML) footer = footer.replace(htmlFilter, "");
                    footers.push(footer);
                }
                if (options._export_mode === "excel") data.push(footers);
            }
        }
        return data;
    }
    function getSpans(view, options) {
        var pull = view._spans_pull;
        var spans = [];

        if (pull) {
            //correction for spreadsheet
            var xc = options.xCorrection || 0;
            var yc = options.yCorrection || 0;
            for (var row in pull) {
                //{ s:{c:1, r:0}, e:{c:3, r:0} }
                var cols = pull[row];
                for (var col in cols) {
                    var sc = view.getColumnIndex(col) - xc;
                    var sr = view.getIndexById(row) - yc;
                    var ec = sc + cols[col][0] - 1;
                    var er = sr + (cols[col][1] - 1);

                    //+1 to exclude excel header
                    spans.push({ s: { c: sc, r: sr + 1 }, e: { c: ec, r: er + 1 } });
                }
            }
        }
        return spans;
    }
    var table = "_table";
    function getExcelData(data, scheme, spans) {
        var ws = {};
        var range = { s: { c: 10000000, r: 10000000 }, e: { c: 0, r: 0 } };
        for (var R = 0; R != data.length; ++R) {
            for (var C = 0; C != data[R].length; ++C) {
                if (range.s.r > R) range.s.r = R;
                if (range.s.c > C) range.s.c = C;
                if (range.e.r < R) range.e.r = R;
                if (range.e.c < C) range.e.c = C;

                var cell = { v: data[R][C] };
                if (cell.v === null) continue;
                var cell_ref = XLSX.utils.encode_cell({ c: C, r: R });

                if (typeof cell.v === 'number') cell.t = 'n';
                else if (typeof cell.v === 'boolean') cell.t = 'b';
                else if (cell.v instanceof Date) {
                    cell.t = 'n'; cell.z = XLSX.SSF[table][14];
                    cell.v = excelDate(cell.v);
                }
                else cell.t = 's';

                ws[cell_ref] = cell;
            }
        }
        if (range.s.c < 10000000) ws['!ref'] = XLSX.utils.encode_range(range);

        ws['!cols'] = getColumnsWidths(scheme);
        if (spans.length)
            ws["!merges"] = spans;
        return ws;
    }
    function getColumnsWidths(scheme) {
        var wscols = [];
        for (var i = 0; i < scheme.length; i++)
            wscols.push({ wch: scheme[i].width });

        return wscols;
    }
    function str2array(s) {
        var buf = new ArrayBuffer(s.length);
        var view = new Uint8Array(buf);
        for (var i = 0; i != s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
        return buf;
    }
    function dwonLoadExcel(items) {
        var scheme = getExportScheme(view, options);
        //alert(JSON.stringify(scheme)); return;
        var result = getExportData({ data: items }, options, scheme);
        //alert(JSON.stringify(result)); return;

        var spans = options.spans ? getSpans(view, options) : [];
        //alert(JSON.stringify(spans)); return;
        var data = getExcelData(result, scheme, spans);

        var wb = { SheetNames: [], Sheets: [] };
        var name = options.name || "Data";
        wb.SheetNames.push(name);
        wb.Sheets[name] = data;

        var xls = XLSX.write(wb, { bookType: 'xlsx', bookSST: false, type: 'binary' });
        var filename = (options.filename || name) + ".xlsx";

        var blob = new Blob([str2array(xls)], { type: "application/xlsx" });
        smdui.html.download(blob, filename);
    }

    var xlsxurl = "../jsxlsx/dist/xlsx.core.min.js";
    smdui.require(xlsxurl, function () {
        options._export_mode = "excel";
        if (options.reload == 1) {
            $smd.post($smd.handlers.GetListItemsNoPage, options.request, function (ret) {
                if (ret.status == 1) {
                    var items = ret.data.items;
                    items = items.concat(ret.data.fitems);
                    dwonLoadExcel(items);
                } else {
                    $smd.errorTips(ret.msg);
                }
            });
        } else {
            var dataStore = view.data;
            var items = [];
            for (var i = 0; i < dataStore.order.length; i++) {
                var id = dataStore.order[i];
                items.push(dataStore.pull[id]);
            }
            dwonLoadExcel(items);
        }

    });

    return defer;
};

/*
 *通用数据接口,依赖smdui,Jquery
 */
$smd.Refer = function (param, smdform) {
    var _param = $.extend(true, {}, {
        id: "ref_" + smdui.uid(),
        target: "",
        editable: false,
        relative: "bottom",
        ctype: 0, //0:表格 1:树结构
        data: {
            selectId: "",
            module: "",
            request: [],
            glsx: ""
        },
        width: 500,
        height: 350,
        grid: {
            searchVal: "",
            id: "ref_grid_" + smdui.uid(),
            columns: [],
            pager: {
                size: 8,
                group: 5,
                pageIndex: 1,
                recordCount: 0,
                pageCount: 0,
                template: "{common.first()} {common.prev()} {common.pages()} {common.next()} {common.last()}",
                refresh: function () {
                    var obj = this;
                    if (obj.recordCount == 0) obj.pageCount = 0;
                    else {
                        obj.pageCount = parseInt(obj.recordCount / obj.size);
                        if (obj.recordCount % obj.size != 0) obj.pageCount++;
                    }
                }
            },
            keycol: ""
        },
        tree: {
            id: "ref_tree_" + smdui.uid()
        },
        back: {
            sets: [
            ],
            selectId: "",
            module: "",
            request: [],
            response: [],
            noDataNoSet: 0,
            afterSelected: function (item) {
            }
        },
        form: { url: "", openway: 3, title: "", width: 750, height: 600, fullscreen: false }
    }, param);
    var _smdform = smdform;
    var _refer = this;
    this.target = {
        obj: null,
        type: 1,   //1form 2datatable
        searchobj: null  //查询对象
    };
    this.config = _param;
    this.hotkeying = false;
    this.oldValue = "";
    this.dataLoaded = false;//数据是否已加载，初始化用

    function _get_refs(value) {
        var reg = /(\[[^\[,\]]*\])|(\[([^\]]+),([^\]]+)\])/g
        var cells = value.match(reg);
        if (cells === null) cells = [];

        for (var i = 0; i < cells.length; i++) {
            var cell = cells[i];
            cell = $smd.trim(cell);
            cell = cell.substr(1, cell.length - 2);
            cells[i] = cell;
        }
        return cells;
    }
    function _request_glsx_init() {
        if (_param.data.glsx != "") {
            var arr = _get_refs(_param.data.glsx);
            for (var k = 0; k < arr.length; k++) {
                var cell = arr[k];
                if (cell.indexOf(',') < 0) {//主表单
                    var obj = _smdform.getElement(cell);
                    if (obj == null || obj == undefined) {
                        $smd.errorTips("关联刷新元素" + cell + "不存在！");
                        continue;
                    }
                    obj.attachEvent("onChange", function (newv, oldv) {
                        // alert(newv);
                        _refer.dataLoaded = false;
                    });
                }
            }
        }
    }

    this.init = function () {
        if (_param.ctype == 0) {
            this.grid.init();
        } else {
            this.tree.init();
        }
        _request_glsx_init();
    }

    this.load = function () {
        if (_param.ctype == 0) {
            _refer.grid.load(0);
        }
    }

    this.grid = {
        init: function () {
            var that = this;
            var arr = _param.target.split(",");
            var obj = smdui.ui({
                view: "popup",
                id: _param.id,
                width: _param.width,
                height: _param.height,
                relative: _param.relative,
                autofocus: false,
                body: {
                    rows: [
                        {
                            view: "datatable",
                            id: _param.grid.id, select: "row", resizeColumn: true,
                            navigation: true, rowHeight: 28,
                            columns: _param.grid.columns
                        },
                        {
                            height: 30,
                            cols: [
                                {
                                    id: "referpup_pager_" + _param.grid.id, "view": "pager", height: 30, master: false,
                                    template: _param.grid.pager.template,
                                    size: _param.grid.pager.size,
                                    count: 0,
                                    group: _param.grid.pager.group,
                                    on: {
                                        onItemClick: function (id, e, node) {
                                            that.load(id);
                                        }
                                    }
                                },
                                { view: "button", id: "cz_popok_" + _param.grid.id, label: "确定", type: "danger", width: 50 },
                                { width: 20 }
                            ]
                        }
                    ]
                }
            }).hide();
            if (_param.form.url != "") {
                var layout = smdui.$$(_param.grid.id).getParentView();
                if (!_param.editable) {
                    layout.addView({
                        cols: [
                            { view: "text", label: "关键字", labelWidth: 50, id: "txt_serach_" + _param.grid.id },
                            { width: 5 },
                            { view: "button", type: "icon", icon: "16_add", label: "新增", width: 70, click: that.addWin },
                            { view: "button", type: "icon", icon: "16_edit", label: "修改", width: 70, click: that.editWin },
                            { width: 5 }
                        ]
                    }, 0);
                } else {
                    layout.addView({
                        cols: [
                            {},
                            { view: "button", type: "icon", icon: "16_add", label: "新增", width: 70, click: that.addWin },
                            { view: "button", type: "icon", icon: "16_edit", label: "修改", width: 70, click: that.editWin },
                            { width: 20 }
                        ]
                    }, 0);
                }
            } else {
                if (!_param.editable) {
                    var layout = smdui.$$(_param.grid.id).getParentView();
                    layout.addView({
                        cols: [
                            { view: "text", label: "关键字", id: "txt_serach_" + _param.grid.id }
                        ]
                    }, 0);
                }
            }

            if (arr.length > 1) {//表格
                _refer.target.type = 2;
                var gridId = arr[0];
                var colName = arr[1];
                var gridObj = _smdform.elements(gridId)
                var cols = gridObj.config.columns;
                for (var i = 0; i < cols.length; i++) {
                    if (cols[i].id == colName) {
                        cols[i].popup = _param.id;
                        cols[i].editable = _param.editable;
                        cols[i].editor = "popuptext";
                        cols[i].header = cols[i].header[0].text + "<span class='smdui_input_icon fa-search' style='height:22.5px;padding-top:2.5px;background:none' ></span>";
                        break;
                    }
                }
                gridObj.refreshColumns();
                gridObj.attachEvent("onTimedKeyPress", function (view) {
                    var editor = gridObj.getEditor();
                    var colid = editor.column;
                    if (arr[1] == colid) {
                        if (_refer.hotkeying) return;
                        var pupobj = smdui.$$(_param.id);
                        if (!pupobj.isVisible()) {
                            pupobj.show();
                        }
                        var value = editor.getValue();
                        value = $.trim(value);
                        that.setSearchValue(value);
                    }
                });
                gridObj.attachEvent("onKeyPress", function (code, e) {
                    _smdform.math.set_grid(gridId);
                    var editor = gridObj.getEditor();
                    var colid = editor.column;
                    if (arr[1] == colid) {
                        _refer.hotkeying = false;
                        if (code == 37 || code == 38 || code == 39 || code == 40 || code == 13 || code == 9) {
                            _refer.hotkeying = true;
                        }
                        var pupobj = smdui.$$(_param.id);
                        if (pupobj.isVisible()) {
                            var grid = $$(_param.grid.id);
                            var rowId = grid.getSelectedId();
                            if (code == 38) {//上
                                var prevId = grid.getPrevId(rowId);
                                if (prevId == undefined) return;
                                grid.select(prevId);
                            } else if (code == 40) {//下
                                var nextId = grid.getNextId(rowId);
                                if (nextId == undefined) return;
                                grid.select(nextId);
                            } else if (code == 13) {//回车
                                var item = grid.getSelectedItem();
                                _refer.grid.selected(item);
                                return;
                            }
                        }
                    }
                });
                gridObj.attachEvent("onAfterEditStop", function (state, editor, ignoreUpdate) {
                    if (state.value != state.old) {
                        //$smd.tips("4444");
                        var colid = editor.column;
                        if (arr[1] == colid) {
                            //$smd.tips(colid);
                            var item = null;
                            _refer.grid.selected(item);
                        }
                    }
                });
                _refer.target.obj = gridObj;
            } else {//表单
                _refer.target.type = 1;
                var formobj = _smdform.elements(_param.target);
                formobj.define("popup", _param.id);
                formobj.refresh();
                _refer.target.obj = formobj;
                _refer.target.searchobj = formobj;
                if (!_param.editable) {//不可编辑
                    $(_refer.target.obj.getInputNode()).attr("readonly", "readonly"); //默认单元格不可编辑
                    _refer.target.searchobj = $$("txt_serach_" + _param.grid.id);
                } else {
                    formobj.attachEvent("onBlur", function (e) {
                        var pupobj = smdui.$$(_param.id);
                        if (pupobj.isVisible()) {
                            var box = smdui.html.offset(pupobj._viewobj);
                            var pos = smdui.html.pos();
                            if (isNaN(pos.x) || isNaN(pos.y)) {
                                return;
                            }
                            if (pos.x >= box.x && pos.x <= box.x + box.width && pos.y >= box.y && pos.y <= box.y + box.height) {
                                return;
                            }
                            pupobj.hide();
                        }
                        var node = this.getInputNode();
                        if (_refer.oldValue == node.value)
                            return;
                        _refer.oldValue = node.value;
                        var item = null;
                        _refer.grid.selected(item);
                    });
                }
                _refer.target.searchobj.attachEvent("onTimedKeyPress", function () {
                    if (_refer.hotkeying) return;
                    var pupobj = smdui.$$(_param.id);
                    if (!pupobj.isVisible()) {
                        pupobj.show();
                    }
                    var value = _refer.target.searchobj.getValue();
                    value = $.trim(value);
                    that.setSearchValue(value);
                });
                _refer.target.searchobj.attachEvent("onKeyPress", function (code, e) {
                    _refer.hotkeying = false;
                    if (code == 37 || code == 38 || code == 39 || code == 40 || code == 13 || code == 9) {
                        _refer.hotkeying = true;
                    }
                    var pupobj = smdui.$$(_param.id);
                    if (pupobj.isVisible()) {
                        var grid = $$(_param.grid.id);
                        var rowId = grid.getSelectedId();
                        if (code == 38) {//上
                            var prevId = grid.getPrevId(rowId);
                            if (prevId == undefined) return;
                            grid.select(prevId);
                        } else if (code == 40) {//下
                            var nextId = grid.getNextId(rowId);
                            if (nextId == undefined) return;
                            grid.select(nextId);
                        } else if (code == 13) {//回车
                            var item = grid.getSelectedItem();
                            _refer.grid.selected(item);
                        }
                    }
                });
            }
            //行双击
            $$(_param.grid.id).attachEvent("onItemDblClick", function (id, e, node) {
                var grid = $$(_param.grid.id);
                var item = grid.getItem(id);
                _refer.grid.selected(item);
            });
            //选择返回按钮
            $$("cz_popok_" + _param.grid.id).attachEvent("onItemClick", function (id, e, node) {
                var item = $$(_param.grid.id).getSelectedItem();
                _refer.grid.selected(item);
            });

            $$(_param.id).attachEvent("onShow", function () {
                if (!_param.editable) {//不可编辑
                    _refer.target.searchobj.focus();
                }
                setTimeout(function () {
                    if (!_refer.dataLoaded) {
                        _refer.grid.load(0);
                    }
                }, 500);
            });

            //if (_param.data.autoLoad) {
            //    _refer.grid.load(0);
            //}
        },
        load: function (pindid) {
            var pindex = 1;
            var obj = _param.grid;
            function _getParams() {
                if (pindid == "next") {
                    if (obj.pager.pageIndex == obj.pager.pageCount) return null;
                    pindex = obj.pageIndex + 1;
                } else if (pindid == "last") {
                    pindex = obj.pager.pageCount;
                } else if (pindid == "prev") {
                    if (obj.pager.pageIndex == 1) return null;
                    pindex = obj.pager.pageIndex - 1;
                } else if (pindid == "first") {
                    pindex = 1;
                } else {
                    pindex = parseInt(pindid) + 1;
                }

                var p = { "selectid": _param.data.selectId, "module": _param.data.module, "pageIndex": pindex, "size": obj.pager.size };
                var kval = _param.grid.searchVal;
                p["kval"] = kval;
                for (var i in _param.data.request) {
                    p[i] = _smdform.getReqVal2(_param.data.request[i]);
                }
                return p;
            }

            function requestPopupOk(ret) {
                //alert(JSON.stringify(ret));
                var gridId = obj.id;
                if (ret.status == 1) {
                    $$(gridId).clearAll();
                    $$(gridId).parse(ret.data.items, "json");

                    obj.pager.pageIndex = pindex;
                    obj.pager.recordCount = ret.data.recordCount;
                    obj.pager.refresh();

                    $$("referpup_pager_" + gridId).define({ "page": obj.pager.pageIndex - 1, "count": obj.pager.recordCount });
                    $$("referpup_pager_" + gridId).refresh();

                    if (!_refer.dataLoaded)
                        _refer.dataLoaded = true;

                } else {
                    $smd.errorTips(ret.msg);
                }
            }

            var p = _getParams();
            //alert(JSON.stringify(p));
            if (p == null) return;
            $smd.post($smd.handlers.GetListItems, p, requestPopupOk);
        },
        selected: function (item) {
            var obj = smdui.$$(_param.id);
            if (obj.isVisible()) {
                obj.hide();
            }
            var back = _param.back;
            if (back.sets) {
                if (item != null) {
                    var sets = back.sets;
                    if (_refer.target.type == 1) {
                        var myform = _smdform.formobj();
                        if (sets.length > 0) {
                            for (var i = 0; i < sets.length; i++) {
                                var obj = sets[i];
                                myform.elements[obj.ele].setValue(item[obj.property]);
                            }
                        } else {
                            for (var a in item) {
                                var t = myform.elements[a];
                                if (t == undefined) continue;
                                t.setValue(item[a]);
                            }
                        }
                    } else {
                        _refer.target.obj.editStop();//停止编辑
                        _smdform.math.set_grid(_refer.target.obj);//设置默认表格

                        var selectId = _refer.target.obj.getSelectedId();
                        var updateItem_old = _refer.target.obj.getSelectedItem();
                        var updateItem = {};
                        //debugger;
                        //delete updateItem["id"];//id不更新
                        if (sets.length > 0) {
                            for (var i = 0; i < sets.length; i++) {
                                var obj = sets[i];
                                if (updateItem_old[obj.ele] == undefined) continue;
                                updateItem[obj.ele] = item[obj.property];
                            }
                        } else {
                            for (var a in item) {
                                if (updateItem_old[a] == undefined) continue;
                                updateItem[a] = item[a];
                            }
                        }
                        _refer.target.obj.updateItem(selectId, updateItem);
                    }
                }
                if (back.selectId != "") {
                    var p = { "selectid": back.selectId, "module": back.module };
                    for (var i in back.request) {
                        p[i] = _smdform.getReqVal2(back.request[i]);
                    }
                    //alert(JSON.stringify(p));
                    $smd.post($smd.handlers.GetSingleItem, p, function (ret) {
                        //alert(JSON.stringify(ret));
                        if (ret.status == 1) {
                            if (ret.data.recordCount == 0 && back.noDataNoSet == 1) {
                                return;
                            }
                            if (_refer.target.type == 1) {
                                if (back.response.length > 0) {
                                    for (var a = 1; a < back.response.length; a++) {
                                        var p = back.response[a];
                                        var t = _smdform.elements(p.to);
                                        if (t == undefined) continue;
                                        t.setValue(ret.data.item[p.from]);
                                    }
                                } else {
                                    for (var a in ret.data.item) {
                                        var t = _smdform.elements(a);
                                        if (t == undefined) continue;
                                        t.setValue(ret.data.item[a]);
                                    }
                                }
                            } else {
                                var selectId = _refer.target.obj.getSelectedId();
                                var updateItem_old = _refer.target.obj.getSelectedItem();
                                var updateItem = {};
                                //alert(JSON.stringify(ret.data.item));
                                for (var a in ret.data.item) {
                                    if (updateItem_old[a] == undefined) continue;
                                    updateItem[a] = ret.data.item[a];
                                }
                                //alert(JSON.stringify(updateItem));
                                _refer.target.obj.updateItem(selectId, updateItem);
                            }
                        } else {
                            $smd.tips(ret.msg, 2000);
                        }
                    }, false);
                }
                if (back.afterSelected != null) {
                    back.afterSelected(item);
                }
            }
        },
        setSearchValue: function (value) {
            _param.grid.searchVal = value;
            this.load(0);
        },
        addWin: function () {
            var formparam = _param.form;
            if (formparam.openway == 3) {//弹出窗口
                var parentId = $smd.urlParam("winId");
                var winId = new Date().valueOf();
                top.$smd.win.open({
                    id: winId,
                    parentId: parentId,
                    title: formparam.title + "-新增",
                    href: formparam.url + "?action=add&winId=" + winId,
                    width: formparam.width,
                    height: formparam.height,
                    fullscreen: formparam.fullscreen,
                    onclosed: function () {
                        _refer.grid.load(0);
                    }
                });
            }
        },
        editWin: function (id) {
            var formparam = _param.form;
            var item = $$(_param.grid.id).getSelectedItem();
            if (item == null) {
                top.$smd.errorTips("选择你要编辑的行！");
                return;
            }
            var key = item[_param.grid.keycol];
            if (formparam.openway == 3) {//弹出窗口
                var parentId = $smd.urlParam("winId");
                var winId = new Date().valueOf();
                top.$smd.win.open({
                    id: winId,
                    parentId: parentId,
                    title: formparam.title + "-编辑",
                    href: formparam.url + "?action=edit&&id=" + key + "&winId=" + winId,
                    width: formparam.width,
                    height: formparam.height,
                    fullscreen: formparam.fullscreen,
                    onclosed: function () {
                        var ind = _param.grid.pager.pageIndex - 1;
                        if (ind < 0) ind = 0;
                        _refer.grid.load(ind);
                    }
                });
            }
        }
    };

    this.tree = {
        init: function () {
            var that = this;
            var arr = _param.target.split(",");
            var suggest_ui = {
                id: _param.id,
                fitMaster: false,
                body: {
                    id: _param.tree.id,
                    view: "tree",
                    data: []
                }
            };
            if (arr.length > 1) {//表格
            } else {//表单
                _refer.target.type = 1;
                var formobj = smdui.$$(_param.target);
                //formobj.define("view", "combo");
                formobj.define("suggest", suggest_ui);
                formobj.refresh();
                _refer.target.obj = formobj;
            }
            if (!_refer.dataLoaded) {
                _refer.tree.load();
            }
            //$$(_param.id).attachEvent("onShow", function () {
            //    setTimeout(function () {
            //        if (!_refer.dataLoaded) {
            //            _refer.tree.load();
            //        }
            //    }, 500);
            //});
        },
        load: function () {
            var urls = $smd.handlers.GetTreeList;
            $smd.post(urls, { "selectid": _param.data.selectId, "module": _param.data.module }, function (ret) {
                if (ret.status == 1) {
                    $$(_param.tree.id).clearAll();
                    $$(_param.tree.id).parse(ret.data.items, "json");

                    _refer.dataLoaded = true;
                } else {
                    top.$smd.errorTips("初始化父菜单异常");
                }
            });
        }
    };

    this.init();
}

/*
 *通用附照上传
 */
$smd.Albums = function (param, smdform) {
    var _param = $.extend({
        id: "albums" + (new Date()).valueOf(),
        dataviewid: "albums_dataview" + (new Date()).valueOf(),
        buttonid: "albums_button" + (new Date()).valueOf(),
        width: 330, height: 340,
        target: "",
        selectid: "",
        uploadid: "",
        deleteid: "",
        module: ""
    }, param);
    var _dataIsLoad = false;
    //var that = this;
    //加载数据
    function loadAlbumsData() {
        $smd.post($smd.handlers.GetListItems, {
            selectid: _param.selectid,
            module: _param.module,
            lyid: smdform.getKeyValue()
        }, function (ret) {
            if (ret.status == 1) {
                smdui.$$(_param.dataviewid).clearAll();
                smdui.$$(_param.dataviewid).parse(ret.data.items, "json");

                _dataIsLoad = true;
            } else {
                smdui.$smd.errorTips(ret.msg);
            }
        });
    }

    //删除
    function delAlbumsData(id) {
        $smd.confirm("您将要删除此附照，是否继续？", function (result) {
            if (!result) return;
            $smd.post($smd.handlers.AlbumsDelete, {
                uploadid: _param.deleteid,
                module: _param.module,
                id: id,
                lyid: smdform.getKeyValue()
            }, function (ret) {
                if (ret.status == 1) {
                    loadAlbumsData();
                    $smd.tips("删除成功！");
                } else {
                    $smd.errorTips(ret.msg);
                }
            });
        });
    }

    var popview = smdui.ui({
        view: "popup",
        id: _param.id,
        padding: 0,
        body: {
            width: _param.width, height: _param.height,
            rows: [
                {
                    cols: [
                        {},
                        {
                            view: "uploader", value: '附照上传', id: _param.buttonid,
                            name: "files",
                            upload: $smd.handlers.AlbumsUpLoad, width: 100,
                            formData: {
                                lyid: smdform.getKeyValue(),
                                uploadid: _param.uploadid,
                                module: _param.module
                            }
                        }
                    ]
                },
                {
                    view: "dataview", id: _param.dataviewid,
                    type: {
                        height: 100, width: 100
                    },
                    borderless: false,
                    template: function (obj) {
                        var html = "<div style='position:relative;'>" +                            "<a href='" + obj.original_path + "' target='_blank' class='thumbnail'>" +                            " <img src='" + obj.thumb_path + "' style='height: 100px' />" +                            "</a>" +                            "<a href='javascript:void(0)' albums_id='" + obj.id + "' class='thumbdel' style='position:absolute;bottom:10px;right:10px;'>删除</a>" +                            "</div>";                        return html;

                    }
                }
            ]
        }
    }).hide();
    //首次显示加载数据
    smdui.$$(_param.id).attachEvent("onShow", function () {
        if (!_dataIsLoad) {
            loadAlbumsData();
        }
    });
    //初始化删除事件
    $("div[view_id='" + _param.dataviewid + "']").on("click", ".thumbdel", function () {
        var albums_id = $(this).attr("albums_id");
        delAlbumsData(albums_id);
    });
    //上传完事件
    smdui.$$(_param.buttonid).attachEvent("onFileUpload", function (item, response) {
        //console.log(response);
        if (response.status == 0) {
            $smd.alert(response.msg);
        } else {
            loadAlbumsData();
        }
    });

    smdui.$$(_param.target).define("popup", _param.id);
    smdui.$$(_param.target).refresh();
}