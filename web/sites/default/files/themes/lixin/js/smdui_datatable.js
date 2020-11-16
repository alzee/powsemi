
smdui.protoUI({
    name: "datatable",
    defaults: {
        leftSplit: 0,
        rightSplit: 0,
        topSplit: 0,
        columnWidth: 100,
        minColumnWidth: 20,
        minColumnHeight: 26,
        prerender: false,
        autoheight: false,
        autowidth: false,
        header: true,
        fixedRowHeight: true,
        scrollAlignY: true,
        scrollX: true,
        scrollY: true,
        datafetch: 50,
        navigation: true
    },
    $skin: function () {
        var height = smdui.skin.$active.rowHeight;
        var defaults = this.defaults;
        defaults.rowHeight = height;
        defaults.headerRowHeight = smdui.skin.$active.barHeight;
    },
    on_click: {
        smdui_richfilter: function () {
            return false;
        },
        smdui_table_checkbox: function (e, id) {
            id = this.locate(e);

            var item = this.getItem(id.row);
            var col = this.getColumnConfig(id.column);
            var trg = e.target || e.srcElement;

            //read actual value from HTML tag when possible
            //as it can be affected by dbl-clicks
            var check = (trg.type == "checkbox") ? trg.checked : (item[id.column] != col.checkValue);
            var value = check ? col.checkValue : col.uncheckValue;

            var update = {};
            update[id.column] = value;
            this.updateItem(id.row, update, (this._settings.checkboxRefresh ? "update" : "save"));

            this.callEvent("onCheck", [id.row, id.column, value]);
            return false;
        },
        smdui_table_radio: function (e) {
            var id = this.locate(e);

            var item = this.getItem(id.row);
            var col = this.getColumnConfig(id.column);

            var checked = 0;
            this.eachRow(function (rowid) {
                var item = this.data.pull[rowid];
                if (item && item[id.column] == col.checkValue)
                    item[id.column] = col.uncheckValue;
            });

            item[id.column] = col.checkValue;

            this.callEvent("onCheck", [id.row, id.column, true]);
            this.refresh();
            return false;
        }
    },
    on_dblclick: {
        smdui_table_checkbox: function () {
            return this.on_click.smdui_table_checkbox.apply(this, arguments);
        }
    },
    on_context: {
    },
    $init: function (config) {
        this.on_click = smdui.extend({}, this.on_click);
        var html = "<div class='smdui_ss_header'><div class='smdui_hs_left'></div><div class='smdui_hs_center'></div><div class='smdui_hs_right'></div></div><div class='smdui_ss_body'><div class='smdui_ss_left'><div class='smdui_ss_center_scroll'></div></div>";
        html += "<div class='smdui_ss_center'><div class='smdui_ss_center_scroll' role='rowgroup'></div></div>";
        html += "<div class='smdui_ss_right'><div class='smdui_ss_center_scroll'></div></div></div>";
        html += "<div class='smdui_ss_hscroll' role='scrollbar' aria-orientation='horizontal'></div><div class='smdui_ss_footer'><div class='smdui_hs_left'></div><div class='smdui_hs_center'></div><div class='smdui_hs_right'></div></div><div class='smdui_ss_vscroll_header'></div><div class='smdui_ss_vscroll' role='scrollbar' aria-orientation='vertical'></div><div class='smdui_ss_vscroll_footer'></div>";

        this._contentobj.innerHTML = html;
        this._top_id = this._contentobj.id = this.name + smdui.uid();
        this._contentobj.className += " smdui_dtable";

        this._dataobj = this._contentobj;

        this._header = this._contentobj.firstChild;
        this._body = this._header.nextSibling;
        this._footer = this._body.nextSibling.nextSibling;

        this._viewobj.setAttribute("role", "grid");
        if (!config.editable)
            this._viewobj.setAttribute("aria-readonly", "true");

        this.data.provideApi(this, true);
        this.data.attachEvent("onParse", smdui.bind(this._call_onparse, this));

        this.$ready.push(this._first_render);

        this._columns = [];
        this._headers = [];
        this._footers = [];
        this._rows_cache = [];
        this._active_headers = {};
        this._filter_elements = {};
        this._header_height = this._footer_height = 0;

        //component can create new view
        this._destroy_with_me = [];

        this.data.attachEvent("onServerConfig", smdui.bind(this._config_table_from_file, this));
        this.data.attachEvent("onServerOptions", smdui.bind(this._config_options_from_file, this));
        this.attachEvent("onViewShow", function () {
            this._restore_scroll_state();
            this._refresh_any_header_content();
        });
        this.data.attachEvent("onClearAll", function (soft) {
            if (!soft) {
                this._scrollLeft = this._scrollTop = 0;
                if (this._x_scroll) this._x_scroll.reset();
                if (this._y_scroll) this._y_scroll.reset();
            }
        });
        this.attachEvent("onDestruct", this._clean_config_struct);
        this.attachEvent("onKeyPress", this._onKeyPress);
        this.attachEvent("onScrollY", this._adjust_rows);

        smdui.callEvent("onDataTable", [this, config]);
    },
    _render_initial: function () {
        this._scrollSizeX = this._scrollSizeY = smdui.ui.scrollSize;

        smdui.html.addStyle("#" + this._top_id + " .smdui_cell { height:" + this._settings.rowHeight + "px; line-height:" + (this._settings.rowLineHeight || this._settings.rowHeight) + "px;" + (this._settings.fixedRowHeight ? "" : "white-space:normal;") + " }");
        smdui.html.addStyle("#" + this._top_id + " .smdui_hcell { height:" + this._settings.headerRowHeight + "px; line-height:" + this._settings.headerRowHeight + "px;}");
        this._render_initial = function () { };
    },
    _first_render: function () {
        this.data.attachEvent("onStoreLoad", smdui.bind(this._refresh_any_header_content, this));
        this.data.attachEvent("onSyncApply", smdui.bind(this._refresh_any_header_content, this));
        this.data.attachEvent("onStoreUpdated", smdui.bind(function () { return this.render.apply(this, arguments); }, this));
        this.data.attachEvent("onStoreUpdated", smdui.bind(this._refresh_tracking_header_content, this));
        this.render();
    },
    refresh: function () {
        this.render();
    },
    render: function (id, data, mode) {
        //pure data saving call
        if (mode == "save") return;
        //during dnd we must not repaint anything in mobile webkit
        if (mode == "move") {
            var context = smdui.DragControl.getContext();
            if (context && context.fragile) return;
        }

        if (!this._columns.length) {
            var cols = this._settings.columns;
            if (!cols || !cols.length) {
                if (this._settings.autoConfig && this.data.order.length) {
                    this._dtable_fully_ready = 0;
                    this._autoDetectConfig();
                } else
                    return;
            }
            this._define_structure();
        }

        if (!this.isVisible(this._settings.id) || this.$blockRender)
            return this._render_initial(); //Chrome 34, Custom Font loading bug

        //replace multiple atomic updates by single big repaint
        if (id && data != -1 && (mode == "paint" || mode == "update")) {
            if (this._render_timer)
                clearTimeout(this._render_timer);

            if (!this._render_timer || this._render_timer_id == id) {
                this._render_timer_id = id;
                this._render_timer = smdui.delay(function () {
                    //if only one call - repaint single item
                    this.render(id, -1, mode);
                }, this);
            } else {
                this._render_timer_id = null;
                this._render_timer = smdui.delay(function () {
                    //if ther was a serie of calls - replace them with single full repaint
                    this.render();
                }, this);
            }
            return;
        } else if (this._render_timer) {
            clearTimeout(this._render_timer);
            this._render_timer = 0;
        }

        if (this.callEvent("onBeforeRender", [this.data])) {

            this._render_initial();
            if (!this._dtable_fully_ready)
                this._apply_headers();

            if (this._content_width) {
                if (this["_settings"].experimental && (mode == "paint" || mode == "update") && id)
                    this._repaint_single_row(id);
                else
                    this._check_rendered_cols(true, true);
            }

            if (!id || mode != "update") {
                this._dtable_height = this._get_total_height();
                this._set_split_sizes_y();
            }

            //don't depend on hidden rows/rolumns
            this._viewobj.setAttribute("aria-colcount", Math.max(this._hidden_column_order.length, this._columns.length));
            this._viewobj.setAttribute("aria-rowcount", this.data.count());

            this.callEvent("onAfterRender", [this.data]);
            return true;
        }
    },
    getColumnConfig: function (id) {
        return this._columns_pull[id] || this._hidden_column_hash[id];
    },
    _config_options_from_file: function (colls) {
        for (var key in colls) {
            var column = this.getColumnConfig(key);
            smdui.assert(column, "Orphan collection: " + key);
            var temp = new smdui.DataCollection({
                data: colls[key]
            });
            this._destroy_with_me.push(temp);
            this._bind_collection(temp, column);
        }
    },
    //xml has different configuration structure, fixing
    _config_table_from_file: function (config) {
        if (config.columns && this._dtable_fully_ready)
            this.refreshColumns(null, true);
    },
    _define_structure: function () {
        if (this._settings.columns) {
            this._columns = this._settings.columns;
            this._columns_pull = {};

            for (var i = 0; i < this._columns.length; i++) {
                var col = this._columns[i];
                this._columns_pull[col.id] = col;

                var format = col.cssFormat;
                if (format)
                    col.cssFormat = smdui.toFunctor(format, this.$scope);

                col.width = col.width || this._settings.columnWidth;
                if (typeof col.format == "string")
                    col.format = smdui.i18n[col.format] || window[col.format];

                //default settings for checkboxes and radios
                if (smdui.isUndefined(col.checkValue)) col.checkValue = 1;
                if (smdui.isUndefined(col.uncheckValue)) col.uncheckValue = 0;

                if (col.css && typeof col.css == "object")
                    col.css = smdui.html.createCss(col.css);

                var template = col.template;
                if (template) {
                    if (typeof template == "string")
                        template = template.replace(/#\$value#/g, "#" + col.id + "#");
                    col.template = smdui.template(template);
                }
            }

            this._normalize_headers("header", this._headers);
            this._normalize_headers("footer", this._footers);

            this.callEvent("onStructureLoad", []);
        }
    },
    _define_structure_and_render: function () {
        this._apply_headers();
    },
    _clean_config_struct: function () {
        //remove column technical info from the column
        //it allows to reuse the same config object for new grid
        for (var i = 0; i < this._columns.length; i++) {
            delete this._columns[i].attached;
            delete this._columns[i].node;
        }
    },
    _apply_headers: function () {
        this._rightSplit = this._columns.length - this._settings.rightSplit;
        this._dtable_width = 0;

        for (var i = 0; i < this._columns.length; i++) {
            if (!this._columns[i].node) {

                var temp = smdui.html.create("DIV");
                temp.style.width = this._columns[i].width + "px";
                this._columns[i].node = temp;
            }
            if (i >= this._settings.leftSplit && i < this._rightSplit)
                this._dtable_width += this._columns[i].width;
        }

        var marks = [];

        if (this._settings.rightSplit) {
            var nr = this._columns.length - this._settings.rightSplit;
            marks[nr] = " smdui_first";
            marks[nr - 1] = " smdui_last";
        }
        if (this._settings.leftSplit) {
            var nl = this._settings.leftSplit;
            marks[nl] = " smdui_first";
            marks[nl - 1] = " smdui_last";
        }
        marks[0] = (marks[0] || "") + " smdui_first";
        var last_index = this._columns.length - 1;
        marks[last_index] = (marks[last_index] || "") + " smdui_last";


        for (var i = 0; i < this._columns.length; i++) {
            var node = this._columns[i].node;
            node.setAttribute("column", i);
            node.className = "smdui_column " + (this._columns[i].css || "") + (marks[i] || '');
        }

        this._create_scrolls();

        this._set_columns_positions();
        this._set_split_sizes_x();
        this._render_header_and_footer();

        this._dtable_fully_ready = true;
    },
    _set_columns_positions: function () {
        var left = 0;
        for (var i = 0; i < this._columns.length; i++) {
            var column = this._columns[i];
            if (i == this._settings.leftSplit || i == this._rightSplit)
                left = 0;

            if (column.node) {
                column.node.style.left = left + "px";
                if (this._settings.leftSplit || this._settings.rightSplit) {
                    smdui.html.remove(column.node);
                    column.attached = false;
                }
            }
            left += column.width;
        }
    },
    _render_header_and_footer: function () {
        if (!this._header_fix_width)
            this._header_fix_width = 0;

        this._header_height = this._footer_height = 0;

        if (this._settings.header) {
            this._refreshHeaderContent(this._header, 0, 1);
            this._normalize_headers("header", this._headers);
            this._header_height = this._headers._summ;
            this._render_header_section(this._header, "header", this._headers);
        }
        if (this._settings.footer) {
            this._refreshHeaderContent(this._footer, 0, 1);
            this._normalize_headers("footer", this._footers);
            this._footer_height = this._footers._summ;
            this._render_header_section(this._footer, "footer", this._footers);
        }

        this.refreshHeaderContent(false, false);
        this._size_header_footer_fix();

        if (this._last_sorted)
            this.markSorting(this._last_sorted, this._last_order);
    },
    _getHeaderHeight: function (header, column, ind) {
        var width = 0;
        var colspan = header.colspan || 1;
        var css = "smdui_hcell " + (header.css || "");

        if (header.rotate)
            css += " smdui_measure_rotate";
        else
            for (var i = 0; i < colspan; i++)
                width += this._columns[ind + i] ? this._columns[ind + i].width : this.config.columnWidth;

        var size = smdui.html.getTextSize(
            [header.text],
            css,
            width
        );

        //+1 to compensate for scrollHeight rounding
        return (header.rotate ? size.width : size.height) + 1;
    },
    _normalize_headers: function (collection, heights) {
        var rows = 0;

        for (var i = 0; i < this._columns.length; i++) {
            var data = this._columns[i][collection];
            if (!data || typeof data != "object" || !data.length) {
                if (smdui.isUndefined(data)) {
                    if (collection == "header")
                        data = this._columns[i].id;
                    else
                        data = "";
                }
                data = [data];
            }
            for (var j = 0; j < data.length; j++) {
                if (typeof data[j] != "object")
                    data[j] = { text: data[j] };

                if (data[j] && data[j].height) heights[j] = data[j].height;
                if (data[j] && data[j].autoheight) heights[j] = this._getHeaderHeight(data[j], this._columns[i], i);
            }
            rows = Math.max(rows, data.length);
            this._columns[i][collection] = data;
        }


        heights._summ = rows;
        for (var i = rows - 1; i >= 0; i--) {
            heights[i] = heights[i] || this._settings.headerRowHeight;
            heights._summ += heights[i] * 1;
        }

        //set null to cells included in col|row spans
        for (var i = 0; i < this._columns.length; i++) {
            var col = this._columns[i][collection];
            for (var j = 0; j < col.length; j++) {
                if (col[j] && col[j].rowspan)
                    for (var z = 1; z < col[j].rowspan; z++)
                        col[j + z] = null;
                if (col[j] && col[j].colspan)
                    for (var z = 1; z < col[j].colspan; z++)
                        this._columns[i + z][collection][j] = null;
            }
        }

        //auto-rowspan cells, which has not enough header lines
        for (var i = 0; i < this._columns.length; i++) {
            var data = this._columns[i][collection];
            if (data.length < rows) {
                var end = data.length - 1;
                data[end].rowspan = rows - data.length + 1;
                for (var j = end + 1; j < rows; j++)
                    data[j] = null;
            }
        }
        return rows;
    },
    _find_header_content: function (sec, id) {
        var alltd = sec.getElementsByTagName("TD");
        for (var i = 0; i < alltd.length; i++)
            if (alltd[i].getAttribute("active_id") == id)
                return alltd[i];
    },
    getHeaderContent: function (id) {
        var obj = this._find_header_content(this._header, id);
        if (!obj)
            obj = this._find_header_content(this._footer, id);

        if (obj) {
            var config = this._active_headers[id];
            var type = smdui.ui.datafilter[config.content];

            if (type.getHelper) return type.getHelper(obj, config);
            return {
                type: type,
                getValue: function () { return type.getValue(obj); },
                setValue: function (value) { return type.setValue(obj, value); }
            };
        }
    },
    _summ_next: function (heights, start, i) {
        var summ = i ? -1 : 0;

        i += start;
        for (start; start < i; start++)
            summ += heights[start] + 1;

        return summ;
    },
    _render_subheader: function (start, end, width, name, heights) {
        if (start == end) return "";

        var html = "<table role='presentation' style='width:" + width + "px' cellspacing='0' cellpadding='0'>";
        for (var i = start; i < end; i++) {
            html += "<tr>";
            for (var i = start; i < end; i++)
                html += "<th  style='width:" + this._columns[i].width + "px'></th>";
            html += "</tr>";
        }

        var count = this._columns[0][name].length;
        var block_evs = [];

        for (var j = 0; j < count; j++) {
            html += "<tr section='" + name + "' role='row'>";
            for (var i = start; i < end; i++) {
                var header = this._columns[i][name][j];
                if (header === null) continue;

                if (header.content) {
                    header.contentId = header.contentId || smdui.uid();
                    header.columnId = this._columns[i].id;
                    header.format = this._columns[i].format;

                    smdui.assert(smdui.ui.datafilter, "Filtering extension was not included");
                    smdui.assert(smdui.ui.datafilter[header.content], "Unknown content type: " + header.content);

                    header.text = smdui.ui.datafilter[header.content].render(this, header);
                    this._active_headers[header.contentId] = header;
                    this._has_active_headers = true;
                }

                html += "<td  role='presentation' column='" + (header.colspan ? (header.colspan - 1 + i) : i) + "'";

                var hcss = '';
                if (i == start)
                    hcss += "smdui_first";
                var column_pos = i + (header.colspan ? header.colspan - 1 : 0);
                if (column_pos >= end - 1)
                    hcss += " smdui_last";
                if (hcss)
                    html += ' class="' + hcss + '"';

                var cell_height = heights[j];
                var sheight = "";
                if (header.contentId)
                    html += " active_id='" + header.contentId + "'";
                if (header.colspan)
                    html += " colspan='" + header.colspan + "'";
                if (header.rowspan) {
                    html += " rowspan='" + header.rowspan + "'";
                    cell_height = this._summ_next(this._headers, j, header.rowspan);
                }

                if (cell_height != this._settings.headerRowHeight)
                    sheight = " style='line-height:" + cell_height + "px; height:" + cell_height + "px;'";

                var css = "smdui_hcell";
                var header_css = header.css;
                if (header_css) {
                    if (typeof header_css == "object")
                        header.css = header_css = smdui.html.createCss(header_css);
                    css += " " + header_css;
                }
                if (this._columns[i].$selected)
                    css += " smdui_sel_hcell";

                html += "><div role='columnheader' class='" + css + "'" + sheight + ">";

                var text = (header.text === "" ? "&nbsp;" : header.text);
                if (header.rotate)
                    text = "<div class='smdui_rotate' style='width:" + (cell_height - 10) + "px; transform-origin:center " + (cell_height - 15) / 2 + "px;-webkit-transform-origin:center " + (cell_height - 15) / 2 + "px;'>" + text + "</div>";

                html += text + "</div></td>";
            }
            html += "</tr>";
        }
        html += "</tr></table>";

        return html;
    },
    showItemByIndex: function (row_ind, column_ind) {
        var pager = this._settings.pager;
        if (pager) {
            var target = Math.floor(row_ind / pager.size);
            if (target != pager.page)
                smdui.$$(pager.id).select(target);
        }

        //parameter will be set to -1, to mark that scroll need not to be adjusted
        if (row_ind != -1) {
            var state = this._get_y_range();
            if (row_ind < state[0] + 1 || row_ind >= state[1] - 1) {
                //not visible currently
                var summ = this._getHeightByIndexSumm((pager ? this.data.$min : 0), row_ind);
                if (row_ind < state[0] + 1) {
                    //scroll top - show row at top of screen
                    summ = Math.max(0, summ - 1) - this._top_split_height;
                } else {
                    //scroll bottom - show row at bottom of screen
                    summ += this._getHeightByIndex(row_ind) - this._dtable_offset_height;
                    //because of row rounding we neet to scroll some extra
                    //TODO: create a better heuristic
                    if (row_ind > 0)
                        summ += this._getHeightByIndex(row_ind - 1) - 1;
                }

                this._y_scroll.scrollTo(summ);
            }
        }
        if (column_ind != -1) {
            //ignore split columns - they are always visible
            if (column_ind < this._settings.leftSplit) return;
            if (column_ind >= this._rightSplit) return;

            //very similar to y-logic above
            var state = this._get_x_range();
            if (column_ind < state[0] + 1 || column_ind >= state[1] - 1) {
                //not visible currently
                var summ = 0;
                for (var i = this._settings.leftSplit; i < column_ind; i++)
                    summ += this._columns[i].width;

                /*jsl:ignore*/
                if (column_ind < state[0] + 1) {
                    //scroll to left border
                } else {
                    //scroll to right border
                    summ += this._columns[column_ind].width - this._center_width;
                }
                /*jsl:end*/
                this._x_scroll.scrollTo(summ);
            }
        }
    },
    showCell: function (row, column) {
        if (!column || !row) {
            //if column or row not provided - take from current selection
            var t = this.getSelectedId(true);
            if (t.length == 1) {
                column = column || t[0].column;
                row = row || t[0].row;
            }
        }
        //convert id to index
        column = column ? this.getColumnIndex(column) : -1;
        row = row ? this.getIndexById(row) : -1;
        this.showItemByIndex(row, column);

    },
    scrollTo: function (x, y) {
        if (!this._x_scroll) return;
        if (this._scrollTo_touch)
            return this._scrollTo_touch(x, y);

        if (x !== null)
            this._x_scroll.scrollTo(x);
        if (y !== null)
            this._y_scroll.scrollTo(y);
    },
    getScrollState: function () {
        if (this._getScrollState_touch)
            return this._getScrollState_touch();

        var diff = this._render_scroll_shift ? 0 : (this._render_scroll_diff || 0);
        return { x: (this._scrollLeft || 0), y: (this._scrollTop + diff) };
    },
    showItem: function (id) {
        this.showItemByIndex(this.getIndexById(id), -1);
    },
    _render_header_section: function (sec, name, heights) {
        sec.childNodes[0].innerHTML = this._render_subheader(0, this._settings.leftSplit, this._left_width, name, heights);
        sec.childNodes[1].innerHTML = this._render_subheader(this._settings.leftSplit, this._rightSplit, this._dtable_width, name, heights);
        sec.childNodes[1].onscroll = smdui.bind(this._scroll_with_header, this);
        sec.childNodes[2].innerHTML = this._render_subheader(this._rightSplit, this._columns.length, this._right_width, name, heights);
    },
    _scroll_with_header: function () {
        var active = this.getScrollState().x;
        var header = this._header.childNodes[1].scrollLeft;
        if (header != active)
            this.scrollTo(header, null);
    },
    _refresh_tracking_header_content: function () {
        this.refreshHeaderContent(true, true);
    },
    _refresh_any_header_content: function () {
        this.refreshHeaderContent(false, true);
    },
    //[DEPRECATE] - v3.0, move to private
    refreshHeaderContent: function (trackedOnly, preserve, id) {
        if (this._settings.header) {
            if (preserve) this._refreshHeaderContent(this._header, trackedOnly, 1, id);
            this._refreshHeaderContent(this._header, trackedOnly, 0, id);
        }
        if (this._settings.footer) {
            if (preserve) this._refreshHeaderContent(this._footer, trackedOnly, 1, id);
            this._refreshHeaderContent(this._footer, trackedOnly, 0, id);
        }
    },
    refreshFilter: function (id) {
        if (id && !this._active_headers[id]) return;
        this.refreshHeaderContent(false, true, id);
    },
    _refreshHeaderContent: function (sec, cellTrackOnly, getOnly, byId) {
        if (this._has_active_headers && sec) {
            var alltd = sec.getElementsByTagName("TD");

            for (var i = 0; i < alltd.length; i++) {
                if (alltd[i].getAttribute("active_id")) {
                    var obj = this._active_headers[alltd[i].getAttribute("active_id")];
                    if (byId && byId != obj.columnId) continue;


                    var content = smdui.ui.datafilter[obj.content];

                    if (getOnly) {
                        if (content.getValue)
                            obj.value = content.getValue(alltd[i]);
                    } else if (!cellTrackOnly || content.trackCells) {
                        content.refresh(this, alltd[i], obj);
                    }
                }
            }
        }
    },
    headerContent: [],
    _set_size_scroll_area: function (obj, height, hdx) {
        if (this._scrollSizeY) {

            obj.style.height = Math.max(height, 1) - 1 + "px";
            obj.style.width = (this._rightSplit ? 0 : hdx) + this._scrollSizeY - 1 + "px";

            // temp. fix: Chrome [DIRTY]
            if (smdui.env.isWebKit)
                var w = obj.offsetWidth;
        } else
            obj.style.display = "none";
    },
    _size_header_footer_fix: function () {
        if (this._settings.header)
            this._set_size_scroll_area(this._header_scroll, this._header_height, this._header_fix_width);
        if (this._settings.footer)
            this._set_size_scroll_area(this._footer_scroll, this._footer_height, this._header_fix_width);
    },
    _update_scroll: function (x, y) {
        var hasX = !(this._settings.autowidth || this._settings.scrollX === false);
        this._scrollSizeX = hasX ? smdui.ui.scrollSize : 0;
        var hasY = !(this._settings.autoheight || this._settings.scrollY === false);
        this._scrollSizeY = hasY ? smdui.ui.scrollSize : 0;
        if (smdui.env.touch)
            hasX = hasY = false;
        if (this._x_scroll) {
            this._x_scroll._settings.scrollSize = this._scrollSizeX;
            this._x_scroll._settings.scrollVisible = hasX;
        }
        if (this._y_scroll) {
            this._y_scroll._settings.scrollSize = this._scrollSizeY;
            this._y_scroll._settings.scrollVisible = hasY;
        }
    },
    _create_scrolls: function () {

        this._scrollTop = 0;
        this._scrollLeft = 0;
        var scrx, scry; scrx = scry = 1;

        if (this._settings.autoheight || this._settings.scrollY === false)
            scry = this._scrollSizeY = 0;
        if (this._settings.autowidth || this._settings.scrollX === false)
            scrx = this._scrollSizeX = 0;

        if (smdui.env.touch) scrx = scry = 0;

        if (!this._x_scroll) {
            this._x_scroll = new smdui.ui.vscroll({
                container: this._footer.previousSibling,
                scrollWidth: this._dtable_width,
                scrollSize: this._scrollSizeX,
                scrollVisible: scrx
            });

            //fix for scroll space on Mac
            if (scrx && !this._scrollSizeX && !smdui.env.$customScroll)
                this._x_scroll._viewobj.style.position = "absolute";

            this._x_scroll.attachEvent("onScroll", smdui.bind(this._onscroll_x, this));
        }

        if (!this._y_scroll) {
            this._header_scroll = this._footer.nextSibling;
            var vscroll_view = this._header_scroll.nextSibling;
            this._footer_scroll = vscroll_view.nextSibling;

            this._y_scroll = new smdui.ui.vscroll({
                container: vscroll_view,
                scrollHeight: 100,
                scroll: "y",
                scrollSize: this._scrollSizeY,
                scrollVisible: scry
            });

            this._y_scroll.activeArea(this._body);
            this._x_scroll.activeArea(this._body, true);
            this._y_scroll.attachEvent("onScroll", smdui.bind(this._onscroll_y, this));
        }

        if (this._content_width)
            this.callEvent("onResize", [this._content_width, this._content_height]);

        if (smdui.env.$customScroll)
            smdui.CustomScroll.enable(this);

        this._create_scrolls = function () { };
    },
    columnId: function (index) {
        return this._columns[index].id;
    },
    getColumnIndex: function (id) {
        for (var i = 0; i < this._columns.length; i++)
            if (this._columns[i].id == id)
                return i;
        return -1;
    },
    _getNodeBox: function (rid, cid) {
        var xs = 0, xe = 0, ye = 0, ys = 0;
        var i; var zone = 0;
        for (i = 0; i < this._columns.length; i++) {
            if (this._rightSplit == i || this._settings.leftSplit == i) {
                xs = 0; zone++;
            }
            if (this._columns[i].id == cid)
                break;
            xs += this._columns[i].width;
        }
        xe += this._columns[i].width;

        for (i = 0; i < this.data.order.length; i++) {
            if (this.data.order[i] == rid)
                break;
            ys += this._getHeightByIndex(i);
        }
        ye += this._getHeightByIndex(i);
        return [xs, xe, ys - this._scrollTop, ye, this._body.childNodes[zone]];
    },
    _id_to_string: function () { return this.row; },
    locate: function (node, idOnly) {
        if (this._settings.subview && this != smdui.$$(node)) return null;

        node = node.target || node.srcElement || node;
        while (node && node.getAttribute) {
            if (node === this.$view)
                break;
            var cs = smdui.html._getClassName(node).toString();

            var pos = null;
            if (cs.indexOf("smdui_cell") != -1) {
                pos = this._locate(node);
                if (pos)
                    pos.row = this.data.order[pos.rind];
            }
            if (cs.indexOf("smdui_hcell") != -1) {
                pos = this._locate(node);
                if (pos)
                    pos.header = true;
            }

            if (pos) {
                if (idOnly) return pos.header ? null : pos.row;
                pos.column = this._columns[pos.cind].id;
                pos.toString = this._id_to_string;
                return pos;
            }

            node = node.parentNode;
        }
        return null;
    },
    _locate: function (node) {
        var cdiv = node.parentNode;
        if (!cdiv) return null;
        var column = (node.getAttribute("column") || cdiv.getAttribute("column")) * 1;
        var row = node.getAttribute("row") || 0;
        if (!row)
            for (var i = 0; i < cdiv.childNodes.length; i++)
                if (cdiv.childNodes[i] == node) {
                    if (i >= this._settings.topSplit)
                        row = i + this._columns[column]._yr0 - this._settings.topSplit;
                    else
                        row = i;
                }

        return { rind: row, cind: column };
    },
    _correctScrollSize: function () {
        var center = -this._center_width;
        for (var i = 0; i < this._columns.length; i++)
            center += this._columns[i].width;
        this._scrollLeft = Math.min(this._scrollLeft, Math.max(0, center));
    },
    _updateColsSizeSettings: function (silent) {
        if (!this._dtable_fully_ready) return;

        this._correctScrollSize();
        this._set_columns_positions();
        this._set_split_sizes_x();
        this._render_header_and_footer();

        if (!silent)
            this._check_rendered_cols(false, false);
    },
    setColumnWidth: function (col, width, skip_update) {
        return this._setColumnWidth(this.getColumnIndex(col), width, skip_update);
    },
    _setColumnWidth: function (col, width, skip_update, by_user) {
        if (isNaN(width) || col < 0) return;
        var column = this._columns[col];

        if (column.minWidth && width < column.minWidth)
            width = column.minWidth;
        else if (width < this._settings.minColumnWidth)
            width = this._settings.minColumnWidth;

        var old = column.width;
        if (old != width) {
            if (col >= this._settings.leftSplit && col < this._rightSplit)
                this._dtable_width += width - old;

            column.width = width;
            if (column.node) //method can be called from onStructLoad
                column.node.style.width = width + "px";
            else
                return false;

            if (!skip_update)
                this._updateColsSizeSettings();

            this.callEvent("onColumnResize", [column.id, width, old, !!by_user]);
            return true;
        }
        return false;
    },
    _getRowHeight: function (row) {
        return (row.$height || this._settings.rowHeight) + (row.$subopen ? row.$subHeight : 0);
    },
    _getHeightByIndex: function (index) {
        var id = this.data.order[index];
        if (!id) return this._settings.rowHeight;
        return this._getRowHeight(this.data.pull[id]);
    },
    _getHeightByIndexSumm: function (index1, index2) {
        if (this._settings.fixedRowHeight)
            return (index2 - index1) * this._settings.rowHeight;
        else {
            var summ = 0;
            for (; index1 < index2; index1++)
                summ += this._getHeightByIndex(index1);
            return summ;
        }
    },
    _cellPosition: function (row, column) {
        var top;
        if (arguments.length == 1) {
            column = row.column; row = row.row;
        }
        var item = this.getItem(row);
        var config = this.getColumnConfig(column);
        var left = 0;
        var parent = 0;

        for (var index = 0; index < this._columns.length; index++) {
            if (index == this._settings.leftSplit || index == this._rightSplit)
                left = 0;
            var leftcolumn = this._columns[index];
            if (leftcolumn.id == column) {
                var split_column = index < this._settings.leftSplit ? 0 : (index >= this._rightSplit ? 2 : 1);
                parent = this._body.childNodes[split_column].firstChild;
                break;
            }

            left += leftcolumn.width;
        }


        if (this.getIndexById(row) < this._settings.topSplit)
            top = this._getHeightByIndexSumm(0, this.getIndexById(row));
        else
            top = this._getHeightByIndexSumm((this._render_scroll_top || 0) - this._settings.topSplit, this.getIndexById(row)) + (this._render_scroll_shift || 0);

        return {
            parent: parent,
            top: top,
            left: left,
            width: config.width,
            height: (item.$height || this._settings.rowHeight)
        };
    },
    _get_total_height: function () {
        var pager = this._settings.pager;
        var start = 0;
        var max = this.data.order.length;

        if (pager) {
            start = pager.size * pager.page;
            max = Math.min(max, start + pager.size);
            if (pager.level) {
                start = this.data.$min;
                max = this.data.$max;
            }
        }

        return this._getHeightByIndexSumm(start, max);
    },
    setRowHeight: function (rowId, height) {
        if (isNaN(height)) return;
        if (height < this._settings.minColumnHeight)
            height = this._settings.minColumnHeight;

        var item = this.getItem(rowId);
        var old_height = item.$height || this._settings.rowHeight;

        if (old_height != height) {
            item.$height = height;
            this.config.fixedRowHeight = false;
            this.render();
            this.callEvent("onRowResize", [rowId, height, old_height]);
        }
    },
    _onscroll_y: function (value) {
        var scrollChange = (this._scrollTop !== value);

        this._scrollTop = value;
        if (!this._settings.prerender) {
            this._check_rendered_cols();
        }
        else {
            var conts = this._body.childNodes;
            for (var i = 0; i < conts.length; i++) {
                conts[i].scrollTop = value;
            }
        }

        if (smdui.env.$customScroll) smdui.CustomScroll._update_scroll(this._body);
        if (scrollChange) {
            this.callEvent("onScrollY", []);
            this.callEvent("onAfterScroll", []);
        }
    },
    _onscroll_x: function (value) {
        var scrollChange = (this._scrollLeft !== value);

        this._body.childNodes[1].scrollLeft = this._scrollLeft = value;
        if (this._settings.header)
            this._header.childNodes[1].scrollLeft = value;
        if (this._settings.footer)
            this._footer.childNodes[1].scrollLeft = value;
        if (this._settings.prerender === false)
            this._check_rendered_cols(this._minimize_dom_changes ? false : true);

        if (smdui.env.$customScroll) smdui.CustomScroll._update_scroll(this._body);

        if (scrollChange) {
            this.callEvent("onScrollX", []);
            this.callEvent("onAfterScroll", []);
        }
    },
    _get_x_range: function (full) {
        if (full) return [0, this._columns.length];

        var t = this._scrollLeft;

        var xind = this._settings.leftSplit;
        while (t > 0 && this._columns.length - 1 > xind) {
            t -= this._columns[xind].width;
            xind++;
        }
        var xend = xind;
        if (t) xind--;

        t += this._center_width;
        while (t > 0 && xend < this._rightSplit) {
            t -= this._columns[xend].width;
            xend++;
        }

        return [xind, xend];
    },
    getVisibleCount: function () {
        return Math.floor((this._dtable_offset_height) / this.config.rowHeight);
    },
    //returns info about y-scroll position
    _get_y_range: function (full) {
        var t = this._scrollTop;
        var start = 0;
        var end = this.count();

        //apply pager, if defined
        var pager = this._settings.pager;
        if (pager) {
            var start = pager.page * pager.size;
            var end = Math.min(end, start + pager.size);
            if (pager.level) {
                start = this.data.$min;
                end = this.data.$max;
            }
        }

        //in case of autoheight - request full rendering
        if (this._settings.autoheight)
            return [start, end, 0];




        if (full) return [start, end, 0];
        var xind = start;
        var rowHeight = this._settings.fixedRowHeight ? this._settings.rowHeight : 0;
        if (rowHeight) {
            var dep = Math.ceil(t / rowHeight);
            t -= dep * rowHeight;
            xind += dep;
        } else
            while (t > 0) {
                t -= this._getHeightByIndex(xind);
                xind++;
            }

        var topSplit = this._settings.topSplit;
        if (topSplit)
            xind += topSplit;

        //how much of the first cell is scrolled out
        var xdef = (xind > 0 && t) ? -(this._getHeightByIndex(xind - 1) + t) : 0;
        var xend = xind;
        if (t) xind--;

        t += (this._dtable_offset_height || this._content_height) - (this._top_split_height || 0);



        if (rowHeight) {
            var dep = Math.ceil(t / rowHeight);
            t -= dep * rowHeight;
            xend += dep;
        } else {
            while (t > 0 && xend < end) {
                t -= this._getHeightByIndex(xend);
                xend++;
            }
        }

        if (xend > end)
            xend = end;

        return [xind, xend, xdef];
    },
    _repaint_single_row: function (id) {
        var item = this.getItem(id);
        var rowindex = this.getIndexById(id);

        var state = this._get_y_range();
        //row not visible
        if (rowindex < state[0] || rowindex >= state[1]) return;

        //get visible column
        var x_range = this._get_x_range();
        for (var i = 0; i < this._columns.length; i++) {
            var column = this._columns[i];

            //column not visible
            if (i < this._rightSplit && i >= this._settings.leftSplit && (i < x_range[0] || i > x_range[1]))
                column._yr0 = -999; //ensure that column will not be reused

            if (column.attached && column.node) {
                var node = column.node.childNodes[rowindex - state[0]];
                var value = this._getValue(item, this._columns[i], 0);

                node.innerHTML = value;
                node.className = this._getCss(this._columns[i], value, item, id);
            }
        }
    },
    _check_rendered_cols: function (x_scroll, force) {
        if (!this._columns.length) return;

        if (force)
            this._clearColumnCache();

        if (smdui.debug_render)
            smdui.log("Render: " + this.name + "@" + this._settings.id);


        var xr = this._get_x_range(this._settings.prerender);
        var yr = this._get_y_range(this._settings.prerender === true);

        if (x_scroll) {
            for (var i = this._settings.leftSplit; i < xr[0]; i++)
                this._hideColumn(i, force);
            for (var i = xr[1]; i < this._rightSplit; i++)
                this._hideColumn(i, force);
        }

        this._render_full_rows = [];
        var rendered = 0;

        for (var i = 0; i < this._settings.leftSplit; i++)
            rendered += this._renderColumn(i, yr, force);
        for (var i = xr[0]; i < xr[1]; i++)
            rendered += this._renderColumn(i, yr, force, i == xr[0]);
        for (var i = this._rightSplit; i < this._columns.length; i++)
            rendered += this._renderColumn(i, yr, force);

        this._check_and_render_full_rows(yr[0], yr[1], force);
        this._check_load_next(yr);
    },
    _delete_full_rows: function (start, end) {
        this._rows_cache_start = start;
        this._rows_cache_end = end;

        smdui.html.remove(this._rows_cache);
        this._rows_cache = [];
    },
    _adjust_rows: function () {
        if (this._settings.prerender && this._rows_body) {
            var state = this.getScrollState();
            this._rows_body.style.top = "-" + (state.y || 0) + "px";
        }
    },
    _check_and_render_full_rows: function (start, end, force) {
        if (this._rows_body)
            this._rows_body.style.top = this._render_scroll_shift + "px";

        if (!force && start == this._rows_cache_start && end == this._rows_cache_end)
            return;

        this._delete_full_rows(start, end);

        if (this._render_full_row_some)
            this._render_full_row_some = false;
        else return;

        for (var i = 0; i < this._render_full_rows.length; i++) {
            var info = this._render_full_rows[i];
            var item = this.getItem(info.id);

            var value;
            if (typeof item.$row == "function") {
                value = item.$row.call(this, item, this.type);
            } else {
                value = this._getValue(item, this.getColumnConfig(item.$row), i);
            }

            var row = this._rows_cache[i] = smdui.html.create("DIV", null, value);
            row.className = "smdui_cell " + (item.$sub ? ("smdui_dtable_sub" + (this._settings.subview ? "view" : "row")) : "smdui_dtable_colrow");
            row.setAttribute("column", 0);
            row.setAttribute("row", info.index);

            var height = (item.$height || this._settings.rowHeight);
            if (item.$subopen)
                row.style.height = item.$subHeight + "px";
            else
                row.style.height = height + "px";

            row.style.paddingRight = smdui.ui.scrollSize + "px";
            row.style.top = info.top + (item.$subopen ? height - 1 : -1) + "px";

            if (!this._rows_body) {
                this._rows_body = smdui.html.create("DIV");
                this._rows_body.style.position = "relative";
                this._rows_body.style.top = this._render_scroll_shift + "px";
                this._body.appendChild(this._rows_body);
            }
            this._rows_body.appendChild(row);
            this.attachEvent("onSyncScroll", function (x, y, t) {
                smdui.Touch._set_matrix(this._rows_body, 0, y, t);
            });
            if (this._settings.subview)
                this.callEvent("onSubViewRender", [item, row]);
        }
    },
    _check_load_next: function (yr) {
        var paging = this._settings.pager;
        var fetch = this._settings.datafetch;

        var direction = (!this._last_valid_render_pos || yr[0] >= this._last_valid_render_pos);
        this._last_valid_render_pos = yr[0];

        if (this._data_request_flag) {
            if (paging && (!fetch || fetch >= paging.size))
                if (this._check_rows([0, paging.size * paging.page], Math.max(fetch, paging.size), true))
                    return (this._data_request_flag = null);

            this._run_load_next(this._data_request_flag, direction);
            this._data_request_flag = null;
        } else {
            if (this._settings.loadahead)
                var check = this._check_rows(yr, this._settings.loadahead, direction);
        }
    },
    _check_rows: function (view, count, dir) {
        var start = view[1];
        var end = start + count;
        if (!dir) {
            start = view[0] - count;
            end = view[0];
        }

        if (start < 0) start = 0;
        end = Math.min(end, this.data.order.length - 1);

        var result = false;
        for (var i = start; i < end; i++)
            if (!this.data.order[i]) {
                if (!result)
                    result = { start: i, count: (end - start) };
                else {
                    result.last = i;
                    result.count = (i - start);
                }
            }
        if (result) {
            this._run_load_next(result, dir);
            return true;
        }
    },
    _run_load_next: function (conf, direction) {
        var count = Math.max(conf.count, (this._settings.datafetch || this._settings.loadahead || 0));
        var start = direction ? conf.start : (conf.last - count + 1);

        if (this._maybe_loading_already(conf.count, conf.start)) return;
        this.loadNext(count, start);
    },
    // necessary for safari only
    _preserveScrollTarget: function (columnNode) {
        if (smdui.env.isSafari) {
            var i, node, newNode, scroll,
                dir = [this._x_scroll, this._y_scroll];

            for (i = 0; i < 2; i++) {
                scroll = dir[i];
                if (scroll && scroll._scroll_trg && scroll._scroll_trg.parentNode == columnNode) {
                    node = scroll._scroll_trg;
                }
            }

            if (node) {
                if (this._scrollWheelTrg)
                    smdui.html.remove(this._scrollWheelTrg);
                this._scrollWheelTrg = node;
                newNode = node.cloneNode(true); // required for _hideColumn
                node.parentNode.insertBefore(newNode, node);
                this._scrollWheelTrg.style.display = "none";
                this._body.appendChild(this._scrollWheelTrg);
            }
        }
    },
    _hideColumn: function (index) {
        var col = this._columns[index];

        // preserve target node for Safari wheel event
        this._preserveScrollTarget(col.node);
        smdui.html.remove(col.node);
        col.attached = false;
    },
    _clearColumnCache: function () {
        for (var i = 0; i < this._columns.length; i++)
            this._columns[i]._yr0 = -1;

        if (this._rows_cache.length) {
            smdui.html.remove(this._rows_cache);
            this._rows_cache = [];
        }
    },
    getText: function (row_id, column_id) {
        return this._getValue(this.getItem(row_id), this.getColumnConfig(column_id), 0);
    },
    getCss: function (row_id, column_id) {
        var item = this.getItem(row_id);
        return this._getCss(this.getColumnConfig(column_id), item[column_id], item, row_id);
    },
    _getCss: function (config, value, item, id) {
        var css = "smdui_cell";

        if (config.cssFormat) {
            var per_css = config.cssFormat(value, item, id, config.id);
            if (per_css) {
                if (typeof per_css == "object")
                    css += " " + smdui.html.createCss(per_css);
                else
                    css += " " + per_css;
            }
        }

        var row_css = item.$css;
        if (row_css) {
            if (typeof row_css == "object")
                item.$css = row_css = smdui.html.createCss(row_css);
            css += " " + row_css;
        }

        var mark = this.data._marks[id];
        if (mark) {
            if (mark.$css)
                css += " " + mark.$css;
            if (mark.$cellCss) {
                var mark_marker = mark.$cellCss[config.id];
                if (mark_marker)
                    css += " " + mark_marker;
            }
        }

        if (item.$cellCss) {
            var css_marker = item.$cellCss[config.id];
            if (css_marker) {
                if (typeof css_marker == "object")
                    css_marker = smdui.html.createCss(css_marker);
                css += " " + css_marker;
            }
        }

        //cell-selection
        var selected = this.data.getMark(item.id, "smdui_selected");
        if ((selected && (selected.$row || selected[config.id])) || config.$selected) css += this._select_css;

        return css;
    },
    _getValue: function (item, config, i) {
        if (!item)
            return "";

        var value;

        value = item[config.id];
        if (value === smdui.undefined || value === null)
            value = "";
        else if (config.format)
            value = config.format(value);
        if (config.template)
            value = config.template(item, this.type, value, config, i);

        return value;
    },
    //we don't use render-stack, but still need a place for common helpers
    //so creating a simple "type" holder
    type: {
        checkbox: function (obj, common, value, config) {
            var checked = (value == config.checkValue) ? 'checked="true"' : '';
            return "<input class='smdui_table_checkbox' type='checkbox' " + checked + ">";
        },
        radio: function (obj, common, value, config) {
            var checked = (value == config.checkValue) ? 'checked="true"' : '';
            return "<input class='smdui_table_radio' type='radio' " + checked + ">";
        },
        editIcon: function () {
            return "<span class='smdui_icon fa-pencil'></span>";
        },
        trashIcon: function () {
            return "<span class='smdui_icon fa-trash'></span>";
        }
    },
    type_setter: function (value) {
        if (!this.types || !this.types[value])
            smdui.type(this, value);
        else {
            this.type = smdui.clone(this.types[value]);
            if (this.type.css)
                this._contentobj.className += " " + this.type.css;
        }
        if (this.type.on_click)
            smdui.extend(this.on_click, this.type.on_click);

        return value;
    },
    _renderColumn: function (index, yr, force, single) {
        var col = this._columns[index];
        if (!col.attached) {
            var split_column = index < this._settings.leftSplit ? 0 : (index >= this._rightSplit ? 2 : 1);
            this._body.childNodes[split_column].firstChild.appendChild(col.node);
            col.attached = true;
            col.split = split_column;
        }

        this._render_scroll_top = yr[0];
        this._render_scroll_shift = 0;
        this._render_scroll_diff = yr[2];

        //if columns not aligned during scroll - set correct scroll top value for each column
        if (this._settings.scrollAlignY) {
            if ((yr[1] == this.data.order.length) || (this.data.$pagesize && yr[1] % this.data.$pagesize === 0)) {
                col.node.style.top = (this._render_scroll_shift = yr[2]) + "px";
            } else if (col._yr2)
                col.node.style.top = "0px";
        } else {
            this._render_scroll_shift = yr[2];
            col.node.style.top = yr[2] + "px";
        }

        if (!force && (col._yr0 == yr[0] && col._yr1 == yr[1]) && (!this._settings.topSplit || col._render_scroll_shift == this._render_scroll_shift)) return 0;

        var html = "";
        var config = this._settings.columns[index];
        var state = {
            row: this._settings.rowHeight,
            total: 0,
            single: single
        };

        for (var i = 0; i < this._settings.topSplit; i++)
            html += this._render_single_cell(i, config, yr, state, -this._render_scroll_shift);

        for (var i = Math.max(yr[0], this._settings.topSplit); i < yr[1]; i++)
            html += this._render_single_cell(i, config, yr, state, -1);

        // preserve target node for Safari wheel event
        this._preserveScrollTarget(col.node);

        col.node.innerHTML = html;
        col._yr0 = yr[0];
        col._yr1 = yr[1];
        col._yr2 = yr[2];
        col._render_scroll_shift = this._render_scroll_shift;
        return 1;
    },
    _render_single_cell: function (i, config, yr, state, top) {
        var id = this.data.order[i];
        var item = this.data.getItem(id);
        var html = "";


        var value;
        if (item) {
            var aria = " role='gridcell' aria-rowindex='" + (i + 1) + "' aria-colindex='" + (this.getColumnIndex(config.id) + 1) + "'" +
                (item.$count || item.$sub ? (" aria-expanded='" + (item.open || item.$subopen ? "true" : "false") + "'") : "") +
                (item.$level ? " aria-level='" + item.$level + "'" : "");

            if (state.single && item.$row) {
                this._render_full_row_some = true;
                this._render_full_rows.push({ top: state.total, id: item.id, index: i });
                if (!item.$sub) {
                    state.total += state.row;
                    return "<div" + aria + " class='smdui_cell'></div>";
                }
            }
            var value = this._getValue(item, config, i);
            var css = this._getCss(config, value, item, id);

            if (css.indexOf("select") !== -1) aria += " aria-selected='true' tabindex='0'";

            var margin = item.$subopen ? "margin-bottom:" + item.$subHeight + "px;" : "";

            if (top >= 0) {
                if (top > 0) margin += "top:" + top + "px;'";
                css = "smdui_topcell " + css;
                if (i == this._settings.topSplit - 1)
                    css = "smdui_last_topcell " + css;
            }
            if (item.$height) {
                html = "<div" + aria + " class='" + css + "' style='height:" + item.$height + "px;" + margin + "'>" + value + "</div>";
                state.total += item.$height - state.row;
            } else {
                html = "<div" + aria + " class='" + css + "'" + (margin ? " style='" + margin + "'" : "") + ">" + value + "</div>";
            }

            if (margin)
                state.total += item.$subHeight;

        } else {
            html = "<div role='gridcell' class='smdui_cell'></div>";
            if (!this._data_request_flag)
                this._data_request_flag = { start: i, count: yr[1] - i };
            else
                this._data_request_flag.last = i;
        }
        state.total += state.row;
        return html;
    },
    _set_split_sizes_y: function () {
        if (!this._columns.length || isNaN(this._content_height * 1)) return;
        smdui.debug_size_box(this, ["y-sizing"], true);

        var wanted_height = this._dtable_height + (this._scrollSizeX ? this._scrollSizeX : 0);
        if ((this._settings.autoheight || this._settings.yCount) && this.resize())
            return;

        this._y_scroll.sizeTo(this._content_height, this._header_height, this._footer_height);
        this._y_scroll.define("scrollHeight", wanted_height);

        this._top_split_height = this._settings.topSplit * this._settings.rowHeight;
        this._dtable_offset_height = Math.max(0, this._content_height - this._scrollSizeX - this._header_height - this._footer_height);
        for (var i = 0; i < 3; i++) {

            this._body.childNodes[i].style.height = this._dtable_offset_height + "px";
            if (this._settings.prerender)
                this._body.childNodes[i].firstChild.style.height = this._dtable_height + "px";
            else
                this._body.childNodes[i].firstChild.style.height = this._dtable_offset_height + "px";
        }
        //prevent float overflow, when we have split and very small
        this._header.style.height = this._header_height + "px";
    },
    _set_split_sizes_x: function () {
        if (!this._columns.length) return;
        if (smdui.debug_size) smdui.log("  - " + this.name + "@" + this._settings.id + " X sizing");

        var index = 0;
        this._left_width = 0;
        this._right_width = 0;
        this._center_width = 0;

        while (index < this._settings.leftSplit) {
            this._left_width += this._columns[index].width;
            index++;
        }

        index = this._columns.length - 1;

        while (index >= this._rightSplit) {
            this._right_width += this._columns[index].width;
            index--;
        }

        if (!this._content_width) return;

        if (this._settings.autowidth && this.resize())
            return;

        this._center_width = this._content_width - this._right_width - this._left_width - this._scrollSizeY;

        this._body.childNodes[1].firstChild.style.width = this._dtable_width + "px";

        this._body.childNodes[0].style.width = this._left_width + "px";
        this._body.childNodes[1].style.width = this._center_width + "px";
        this._body.childNodes[2].style.width = this._right_width + "px";
        this._header.childNodes[0].style.width = this._left_width + "px";
        this._header.childNodes[1].style.width = this._center_width + "px";
        this._header.childNodes[2].style.width = this._right_width + "px";
        this._footer.childNodes[0].style.width = this._left_width + "px";
        this._footer.childNodes[1].style.width = this._center_width + "px";
        this._footer.childNodes[2].style.width = this._right_width + "px";

        var delta = this._center_width - this._dtable_width;
        if (delta < 0) delta = 0; //negative header space has not sense

        if (delta != this._header_fix_width) {
            this._header_fix_width = delta;
            this._size_header_footer_fix();
        }

        // temp. fix: Chrome [DIRTY]
        if (smdui.env.isWebKit) {
            var w = this._body.childNodes[0].offsetWidth;
            w = this._body.childNodes[1].offsetWidth;
            w = this._body.childNodes[1].firstChild.offsetWidth;
            w = this._body.childNodes[2].offsetWidth;
        }

        this._x_scroll.sizeTo(this._content_width - this._scrollSizeY);
        this._x_scroll.define("scrollWidth", this._dtable_width + this._left_width + this._right_width);
    },
    $getSize: function (dx, dy) {
        if ((this._settings.autoheight || this._settings.yCount) && this._settings.columns) {
            //if limit set - use it
            var desired = ((this._settings.yCount || 0) * this._settings.rowHeight);
            //else try to use actual rendered size
            //if component invisible - this is not valid, so fallback to all rows
            if (!desired) desired = this.isVisible() ? this._dtable_height : (this.count() * this._settings.rowHeight);
            //add scroll and check minHeight limit
            this._settings.height = Math.max(desired + (this._scrollSizeX ? this._scrollSizeX : 0) - 1, (this._settings.minHeight || 0)) + this._header_height + this._footer_height;
        }
        if (this._settings.autowidth && this._settings.columns)
            this._settings.width = Math.max(this._dtable_width + this._left_width + this._right_width + this._scrollSizeY, (this._settings.minWidth || 0));


        var minwidth = this._left_width + this._right_width + this._scrollSizeY;
        var sizes = smdui.ui.view.prototype.$getSize.call(this, dx, dy);


        sizes[0] = Math.max(sizes[0] || minwidth);
        return sizes;
    },
    _restore_scroll_state: function () {
        if (this._x_scroll && !smdui.env.touch) {
            var state = this.getScrollState();
            this._x_scroll._last_scroll_pos = this._y_scroll._last_scroll_pos = -1;
            this.scrollTo(state.x, state.y);
        }
    },
    $setSize: function (x, y) {
        var oldw = this._content_width;
        var oldh = this._content_height;

        if (smdui.ui.view.prototype.$setSize.apply(this, arguments)) {
            if (this._dtable_fully_ready) {
                this.callEvent("onResize", [this._content_width, this._content_height, oldw, oldh]);
                this._set_split_sizes_x();
                this._set_split_sizes_y();
            }
            this.render();
        }
    },
    _on_header_click: function (column) {
        var col = this.getColumnConfig(column);
        if (!col.sort) return;

        var order = 'asc';
        if (col.id == this._last_sorted)
            order = this._last_order == "asc" ? "desc" : "asc";

        this._sort(col.id, order, col.sort);
    },
    markSorting: function (column, order) {
        if (!this._sort_sign)
            this._sort_sign = smdui.html.create("DIV");

        var parent = this._sort_sign.parentNode;
        if (parent) {
            parent.removeAttribute("aria-sort");
            parent.removeAttribute("tabindex");
        }
        smdui.html.remove(this._sort_sign);

        if (order) {
            var cell = this._get_header_cell(this.getColumnIndex(column));
            if (cell) {
                this._sort_sign.className = "smdui_ss_sort_" + order;
                cell.style.position = "relative";
                cell.appendChild(this._sort_sign);
                cell.setAttribute("aria-sort", order + "ending");
                cell.setAttribute("tabindex", "0");
            }

            this._last_sorted = column;
            this._last_order = order;
        } else {
            this._last_sorted = this._last_order = null;
        }
    },
    scroll_setter: function (mode) {
        if (typeof mode == "string") {
            this._settings.scrollX = (mode.indexOf("x") != -1);
            this._settings.scrollY = (mode.indexOf("y") != -1);
            return mode;
        } else
            return (this._settings.scrollX = this._settings.scrollY = mode);
    },
    _get_header_cell: function (column) {
        var cells = this._header.getElementsByTagName("TD");
        var maybe = null;
        for (var i = 0; i < cells.length; i++)
            if (cells[i].getAttribute("column") == column && !cells[i].getAttribute("active_id")) {
                maybe = cells[i].firstChild;
                if ((cells[i].colSpan || 0) < 2) return maybe;
            }
        return maybe;
    },
    _sort: function (col_id, direction, type) {
        direction = direction || "asc";
        this.markSorting(col_id, direction);

        if (type == "server") {
            this.callEvent("onBeforeSort", [col_id, direction, type]);
            this.loadNext(0, 0, {
                before: function () {
                    this.clearAll(true);
                },
                success: function () {
                    this.callEvent("onAfterSort", [col_id, direction, type]);
                }
            }, 0, 1);
        } else {
            if (type == "text") {
                this.data.each(function (obj) { obj.$text = this.getText(obj.id, col_id); }, this);
                type = "string"; col_id = "$text";
            }

            if (typeof type == "function")
                this.data.sort(type, direction);
            else
                this.data.sort(col_id, direction, type || "string");
        }
    },
    _mouseEventCall: function (css_call, e, id, trg) {
        var functor, i, res;
        if (css_call.length) {
            for (i = 0; i < css_call.length; i++) {
                functor = smdui.toFunctor(css_call[i], this.$scope);
                res = functor.call(this, e, id, trg);
                if (res === false) return false;
            }
        }
    },
    //because we using non-standard rendering model, custom logic for mouse detection need to be used
    _mouseEvent: function (e, hash, name, pair) {
        e = e || event;
        var trg = e.target || e.srcElement;
        if (this._settings.subview && this != smdui.$$(trg)) return;

        //define some vars, which will be used below
        var css = '',
            css_call = [],
            found = false,
            id = null,
            res,
            trg = e.target || e.srcElement;

        //loop through all parents
        while (trg && trg.parentNode && trg != this._viewobj.parentNode) {
            var trgCss = smdui.html._getClassName(trg);
            if ((css = trgCss)) {
                css = css.toString().split(" ");

                for (var i = css.length - 1; i >= 0; i--)
                    if (hash[css[i]])
                        css_call.push(hash[css[i]]);
            }

            if (trg.parentNode.getAttribute && !id) {
                var column = trg.parentNode.getAttribute("column") || trg.getAttribute("column");
                if (column) { //we need to ignore TD - which is header|footer
                    var isBody = trg.parentNode.tagName == "DIV";

                    //column already hidden or removed
                    if (!this._columns[column]) return;

                    found = true;
                    if (isBody) {
                        var index = trg.parentNode.getAttribute("row") || trg.getAttribute("row");
                        if (!index) {
                            index = smdui.html.index(trg);
                            if (index >= this._settings.topSplit)
                                index += this._columns[column]._yr0 - this._settings.topSplit;
                        }

                        this._item_clicked = id = { row: this.data.order[index], column: this._columns[column].id };
                        id.toString = this._id_to_string;
                    } else
                        this._item_clicked = id = { column: this._columns[column].id };

                    //some custom css handlers was found
                    res = this._mouseEventCall(css_call, e, id, trg);
                    if (res === false) return;

                    //call inner handler
                    if (isBody) {
                        if (this.callEvent("on" + name, [id, e, trg]) && pair) {
                            this.callEvent("on" + pair, [id, e, trg]);
                        }
                    }
                    else if (name == "ItemClick") {
                        var isHeader = (trg.parentNode.parentNode.getAttribute("section") == "header");
                        if (isHeader && this.callEvent("onHeaderClick", [id, e, trg]))
                            this._on_header_click(id.column);
                    }
                    css_call = [];
                }
            }

            trg = trg.parentNode;
        }
        this._mouseEventCall(css_call, e, id, this.$view);
        return found;	//returns true if item was located and event was triggered
    },




    showOverlay: function (message) {
        if (!this._datatable_overlay) {
            var t = smdui.html.create("DIV", { "class": "smdui_overlay" }, "");
            this._body.appendChild(t);
            this._datatable_overlay = t;
        }
        this._datatable_overlay.innerHTML = message;
    },
    hideOverlay: function () {
        if (this._datatable_overlay) {
            smdui.html.remove(this._datatable_overlay);
            this._datatable_overlay = null;
        }
    },
    mapCells: function (startrow, startcol, numrows, numcols, callback, getOnly) {
        if (startrow === null && this.data.order.length > 0) startrow = this.data.order[0];
        if (startcol === null) startcol = this.columnId(0);
        if (numrows === null) numrows = this.data.order.length;
        if (numcols === null) numcols = this._settings.columns.length;

        if (!this.exists(startrow)) return;
        startrow = this.getIndexById(startrow);
        startcol = this.getColumnIndex(startcol);
        if (startcol === null) return;

        for (var i = 0; i < numrows && (startrow + i) < this.data.order.length; i++) {
            var row_ind = startrow + i;
            var row_id = this.data.order[row_ind];
            var item = this.getItem(row_id);
            for (var j = 0; j < numcols && (startcol + j) < this._settings.columns.length; j++) {
                var col_ind = startcol + j;
                var col_id = this.columnId(col_ind);
                var result = callback(item[col_id], row_id, col_id, i, j);
                if (!getOnly)
                    item[col_id] = result;
            }
        }
    },
    _call_onparse: function (driver, data) {
        if (!this._settings.columns && driver.getConfig)
            this.define("columns", driver.getConfig(data));
    },
    _autoDetectConfig: function () {
        var test = this.getItem(this.getFirstId());
        var res = this._settings.columns = [];
        for (var key in test)
            if (key != "id")
                res.push({ id: key, header: key[0].toUpperCase() + key.substr(1), sort: "string", editor: "text" });
        if (res.length)
            res[0].fillspace = true;
        if (typeof this._settings.select == "undefined")
            this.define("select", "row");
    }
}, smdui.AutoTooltip, smdui.Group, smdui.DataMarks, smdui.DataLoader, smdui.MouseEvents, smdui.MapCollection, smdui.ui.view, smdui.EventSystem, smdui.Settings);

smdui.ui.datafilter = {
    textWaitDelay: 500,
    "summColumn": {
        getValue: function (node) { return node.firstChild.innerHTML; },
        setValue: function () { },
        refresh: function (master, node, value) {
            var result = 0;
            master.mapCells(null, value.columnId, null, 1, function (value) {
                value = value * 1;
                if (!isNaN(value))
                    result += value;
            }, true);

            if (value.format)
                result = value.format(result);
            if (value.template)
                result = value.template({ value: result });

            node.firstChild.innerHTML = result;
            master.callEvent("onAfterSumColRef", [value.columnId, result]);
        },
        trackCells: true,
        render: function (master, config) {
            if (config.template)
                config.template = smdui.template(config.template);
            return "";
        }
    },
    "masterCheckbox": {
        getValue: function () { },
        setValue: function () { },
        getHelper: function (node, config) {
            return {
                check: function () { config.checked = false; node.onclick(); },
                uncheck: function () { config.checked = true; node.onclick(); },
                isChecked: function () { return config.checked; }
            };
        },
        refresh: function (master, node, config) {
            node.onclick = function () {
                this.getElementsByTagName("input")[0].checked = config.checked = !config.checked;
                var column = master.getColumnConfig(config.columnId);
                var checked = config.checked ? column.checkValue : column.uncheckValue;
                master.data.each(function (obj) {
                    if (obj) { //dyn loading
                        obj[config.columnId] = checked;
                        master.callEvent("onCheck", [obj.id, config.columnId, checked]);
                        this.callEvent("onStoreUpdated", [obj.id, obj, "save"]);
                    }
                });
                master.refresh();
            };
        },
        render: function (master, config) {
            return "<input type='checkbox' " + (config.checked ? "checked='1'" : "") + ">";
        }
    },
    "textFilter": {
        getInputNode: function (node) { return node.firstChild ? node.firstChild.firstChild : { value: null }; },
        getValue: function (node) { return this.getInputNode(node).value; },
        setValue: function (node, value) { this.getInputNode(node).value = value; },
        refresh: function (master, node, value) {
            node.component = master._settings.id;
            master.registerFilter(node, value, this);
            node._comp_id = master._settings.id;
            if (value.value && this.getValue(node) != value.value) this.setValue(node, value.value);
            node.onclick = smdui.html.preventEvent;
            smdui._event(node, "keydown", this._on_key_down);
        },
        render: function (master, config) {
            if (this.init) this.init(config);
            config.css = "smdui_ss_filter";
            return "<input " + (config.placeholder ? ('placeholder="' + config.placeholder + '" ') : "") + "type='text'>";
        },
        _on_key_down: function (e, node, value) {
            var id = this._comp_id;

            //tabbing through filters must not trigger filtering
            //we can improve this functionality by preserving initial filter value
            //and comparing new one with it
            if ((e.which || e.keyCode) == 9) return;

            if (this._filter_timer) window.clearTimeout(this._filter_timer);
            this._filter_timer = window.setTimeout(function () {
                var ui = smdui.$$(id);
                //ensure that ui is not destroyed yet
                if (ui) ui.filterByAll();
            }, smdui.ui.datafilter.textWaitDelay);
        }
    },
    "selectFilter": {
        getInputNode: function (node) { return node.firstChild ? node.firstChild.firstChild : { value: null }; },
        getValue: function (node) { return this.getInputNode(node).value; },
        setValue: function (node, value) { this.getInputNode(node).value = value; },
        refresh: function (master, node, value) {
            //value - config from header { contet: }
            value.compare = value.compare || function (a, b) { return a == b; };

            node.component = master._settings.id;
            master.registerFilter(node, value, this);

            var data;
            var options = value.options;
            if (options) {
                if (typeof options == "string") {
                    data = value.options = [];
                    smdui.ajax(options).then(smdui.bind(function (data) {
                        value.options = data.json();
                        this.refresh(master, node, value);
                    }, this));
                } else
                    data = options;
            }
            else {
                data = master.collectValues(value.columnId);
                data.unshift({ id: "", value: "" });
            }

            var optview = smdui.$$(options);
            if (optview && optview.data && optview.data.getRange) {
                data = optview.data.getRange();
            }
            //slow in IE
            //http://jsperf.com/select-options-vs-innerhtml

            var select = document.createElement("select");
            for (var i = 0; i < data.length; i++) {
                var option = document.createElement("option");
                option.value = data[i].id;
                option.text = data[i].value;
                select.add(option);
            }

            node.firstChild.innerHTML = "";
            node.firstChild.appendChild(select);

            if (value.value) this.setValue(node, value.value);
            node.onclick = smdui.html.preventEvent;

            select._comp_id = master._settings.id;
            smdui._event(select, "change", this._on_change);
        },
        render: function (master, config) {
            if (this.init) this.init(config);
            config.css = "smdui_ss_filter"; return "";
        },
        _on_change: function (e, node, value) {
            smdui.$$(this._comp_id).filterByAll();
        }
    }
};

smdui.ui.datafilter.serverFilter = smdui.extend({
    $server: true,
    _on_key_down: function (e, node, value) {
        var config, name,
            id = this._comp_id,
            code = (e.which || e.keyCode);

        node = e.target || e.srcElement;
        //ignore tab and navigation keys
        if (code == 9 || (code >= 33 && code <= 40)) return;
        if (this._filter_timer) window.clearTimeout(this._filter_timer);
        this._filter_timer = window.setTimeout(function () {
            smdui.$$(id).filterByAll();
        }, smdui.ui.datafilter.textWaitDelay);
    }
}, smdui.ui.datafilter.textFilter);

smdui.ui.datafilter.serverSelectFilter = smdui.extend({
    $server: true,
    _on_change: function (e, node, value) {
        var id = this._comp_id;
        smdui.$$(id).filterByAll();
    }
}, smdui.ui.datafilter.selectFilter);

smdui.ui.datafilter.numberFilter = smdui.extend({
    init: function (config) {
        config.prepare = function (value, filter) {
            var equality = (value.indexOf("=") != -1) ? 1 : 0;
            var intvalue = this.format(value);
            if (intvalue === "") return "";

            if (value.indexOf(">") != -1)
                config.compare = this._greater;
            else if (value.indexOf("<") != -1) {
                config.compare = this._lesser;
                equality *= -1;
            }
            else {
                config.compare = this._equal;
                equality = 0;
            }

            return intvalue - equality;
        };
    },
    format: function (value) {
        return value.replace(/[^\-\.0-9]/g, "");
    },
    _greater: function (a, b) { return a * 1 > b; },
    _lesser: function (a, b) { return a !== "" && a * 1 < b; },
    _equal: function (a, b) { return a * 1 == b; }
}, smdui.ui.datafilter.textFilter);

smdui.ui.datafilter.dateFilter = smdui.extend({
    format: function (value) {
        if (value === "") return "";
        var date = new Date();

        if (value.indexOf("today") != -1) {
            date = smdui.Date.dayStart(date);
        } else if (value.indexOf("now") == -1) {
            var parts = value.match(/[0-9]+/g);
            if (!parts || !parts.length) return "";
            if (parts.length < 3) {
                parts.reverse();
                date = new Date(parts[0], (parts[1] || 1) - 1, 1);
            } else
                date = smdui.i18n.dateFormatDate(value.replace(/^[>< =]+/, ""));
        }
        return date.valueOf();
    }
}, smdui.ui.datafilter.numberFilter);

smdui.ui.datafilter.headerMenu = {
    getValue: function () { },
    setValue: function () { },
    refresh: function (master, node, config) {
        if (!master._settings.headermenu) {
            master.define("headermenu", true);
            master._generate_menu_columns();
        }

        node.onclick = function () {
            smdui.$$(master.config.headermenu).show(node);
        };
    },
    render: function (master, config) {
        return "<span class='smdui_icon fa-columns' role='button' tabindex='0' aria-label='" + smdui.i18n.aria.headermenu + "'>";
    }
};

smdui.ui.datafilter.richSelectFilter = {
    getInputNode: function (node) {
        return smdui.$$(node.$smdui) || null;
    },
    getValue: function (node) {
        var ui = this.getInputNode(node);
        return ui ? ui.getValue() : "";
    },
    setValue: function (node, value) {
        var ui = this.getInputNode(node);
        return ui ? ui.setValue(value) : "";
    },
    compare: function (a, b) {
        return a == b;
    },
    refresh: function (master, node, value) {
        if (master.$destructed) return;

        var select = smdui.$$(value.richselect);

        //IE8 can destory the content of richselect, so recreating
        if (!select.$view.parentNode) {
            var d = smdui.html.create("div", { "class": "smdui_richfilter" });
            d.appendChild(select.$view);
        }

        node.$smdui = value.richselect;
        node.style.marginLeft = "-10px";

        value.compare = value.compare || this.compare;
        value.prepare = value.prepare || this.prepare;
        master.registerFilter(node, value, this);

        var data;
        var options = value.options;
        if (options) {
            if (typeof options == "string") {
                data = value.options = [];
                smdui.ajax(options).then(smdui.bind(function (data) {
                    value.options = data.json();
                    var node = document.body.contains(node) ? node : document.body.querySelector('[active_id="' + value.contentId + '"]');
                    this.refresh(master, node, value);
                }, this));
            } else
                data = options;
        } else
            data = master.collectValues(value.columnId);


        var list = select.getPopup().getList();

        var optview = smdui.$$(options);
        if (optview && optview.data && optview.data.getRange) {
            data = optview.data.getRange();
        }
        
        //reattaching node back to master container
        node.firstChild.appendChild(select.$view.parentNode);

        //load data in list, must be after reattaching, as callback of parse can try to operate with innerHTML
        if (list.parse) {
            list.clearAll();
            list.parse(data);

            if ((!this.$noEmptyOption && value.emptyOption !== false) || value.emptyOption) {
                var emptyOption = { id: "", value: value.emptyOption || "", $empty: true };
                list.add(emptyOption, 0);
            }
        }

        //set actual value for the filter
        if (value.value) this.setValue(node, value.value);

        //repaint the filter control
        select.render();

        //adjust sizes after full rendering
        smdui.delay(select.resize, select);
    },
    render: function (master, config) {
        if (!config.richselect) {
            var d = smdui.html.create("div", { "class": "smdui_richfilter" });

            var richconfig = {
                container: d,
                view: this.inputtype,
                options: []
            };

            var inputConfig = smdui.extend(this.inputConfig || {}, config.inputConfig || {}, true);
            smdui.extend(richconfig, inputConfig);

            if (config.separator)
                richconfig.separator = config.separator;
            if (config.suggest)
                richconfig.suggest = config.suggest;

            var richselect = smdui.ui(richconfig);
            richselect.attachEvent("onChange", function () {
                master.filterByAll();
            });

            config.richselect = richselect._settings.id;
            master._destroy_with_me.push(richselect);
        }

        config.css = "smdui_div_filter";
        return " ";
    },
    inputtype: "richselect"
};

smdui.ui.datafilter.multiSelectFilter = smdui.extend({
    $noEmptyOption: true,
    inputtype: "multiselect",
    prepare: function (value, filter) {
        if (!value) return value;
        var hash = {};
        var parts = value.toString().split(filter.separator || ",");
        for (var i = 0; i < parts.length; i++)
            hash[parts[i]] = 1;
        return hash;
    },
    compare: function (a, b) {
        return !b || b[a];
    }
}, smdui.ui.datafilter.richSelectFilter);

smdui.ui.datafilter.serverMultiSelectFilter = smdui.extend({
    $server: true,
    _on_change: function (e, node, value) {
        var id = this._comp_id;
        smdui.$$(id).filterByAll();
    }
}, smdui.ui.datafilter.multiSelectFilter);

smdui.ui.datafilter.multiComboFilter = smdui.extend({
    inputtype: "multicombo",
    inputConfig: {
        tagMode: false
    }
}, smdui.ui.datafilter.multiSelectFilter);

smdui.ui.datafilter.serverMultiComboFilter = smdui.extend({
    inputtype: "multicombo",
    inputConfig: {
        tagMode: false
    }
}, smdui.ui.datafilter.serverMultiSelectFilter);

smdui.ui.datafilter.datepickerFilter = smdui.extend({
    prepare: function (value) { return value || ""; },
    compare: function (a, b) { return a * 1 == b * 1; },
    inputtype: "datepicker"
}, smdui.ui.datafilter.richSelectFilter);


smdui.ui.datafilter.columnGroup = {
    getValue: function () { },
    setValue: function () { },
    getHelper: function (node, config) {
        return {
            open: function () { config.closed = true; node.onclick(); },
            close: function () { config.closed = false; node.onclick(); },
            isOpened: function () { return config.closed; }
        };
    },
    refresh: function (master, node, config) {
        node.onclick = function (e) {
            smdui.html.stopEvent(e);
            var mark = this.firstChild.firstChild;
            if (config.closed) {
                config.closed = false;
                mark.className = "smdui_tree_open";
            } else {
                config.closed = true;
                mark.className = "smdui_tree_close";
            }

            smdui.delay(function () {
                master.callEvent("onColumnGroupCollapse", [config.columnId, config.batch, !config.closed]);
                master.showColumnBatch(config.batch, !config.closed);
            });
        };

        if (!config.firstRun) {
            config.firstRun = 1;
            if (config.closed)
                master.showColumnBatch(config.batch, false);
        }
    },
    render: function (master, config) {
        return "<div role='button' tabindex='0' aria-label='" + smdui.i18n.aria[config.closed ? "openGroup" : "closeGroup"] + "' class='" + (config.closed ? "smdui_tree_close" : "smdui_tree_open") + "'></div>&nbsp;" + (config.groupText || "");
    }
};

smdui.ui.datafilter.dateRangeFilter = smdui.extend({
    prepare: function (value) {
        return smdui.ui.daterange.prototype._correct_value(value);
    },
    compare: function (a, b) {
        return ((!b.start || a >= b.start) && (!b.end || a <= b.end));
    },
    inputtype: "daterangepicker"
}, smdui.ui.datafilter.richSelectFilter);

smdui.ui.datafilter.serverDateRangeFilter = smdui.extend({
    $server: true
}, smdui.ui.datafilter.dateRangeFilter);

smdui.extend(smdui.ui.datatable, {
    filterByAll: function () {
        //we need to use dynamic function creating
        var server = false;
        this.data.silent(function () {
            this.filter();
            var first = false;
            for (var key in this._filter_elements) {
                smdui.assert(key, "empty column id for column with filtering");
                if (!this.isColumnVisible(key))
                    continue;
                var record = this._filter_elements[key];
                var originvalue = record[2].getValue(record[0]);

                //saving last filter value, for usage in getState
                var inputvalue = originvalue;
                if (record[1].prepare)
                    inputvalue = record[1].prepare.call(record[2], inputvalue, record[1], this);

                //preserve original value
                record[1].value = originvalue;
                var compare = record[1].compare;

                if (!this.callEvent("onBeforeFilter", [key, inputvalue, record[1]])) continue;
                if (record[2].$server || server) { //if one of filters is server side, do not run any client side filters
                    server = true;
                } else {
                    if (inputvalue === "") continue;

                    if (compare) {
                        compare = this._multi_compare(key, compare);
                        this.filter(smdui.bind(function (obj, value) {
                            if (!obj) return false;
                            return compare(obj[key], value, obj);
                        }, this), inputvalue, first);
                    }
                    else
                        this.filter(key, inputvalue, first);

                    first = true;
                }
            }

            if (server)
                this._runServerFilter();

        }, this);

        if (!server) {
            this.refresh();
            this.callEvent("onAfterFilter", []);
        }
    },
    _multi_compare: function (key, compare) {
        var column = this.getColumnConfig(key);
        var separator = column ? column.optionslist : null;

        //default mode
        if (!separator)
            return compare;

        if (typeof separator != "string")
            separator = ",";

        return function (itemValue, inputValue, obj) {
            if (!itemValue)
                return true;
            var ids = itemValue.split(separator);
            for (var i = 0; i < ids.length; i++) {
                if (compare(ids[i], inputValue, obj))
                    return true;
            }
        };
    },
    filterMode_setter: function (mode) {
        return smdui.extend(this.data._filterMode, mode, true);
    },
    getFilter: function (columnId) {
        var filter = this._filter_elements[columnId];
        smdui.assert(filter, "Filter doesn't exists for column in question");

        if (filter && filter[2].getInputNode)
            return filter[2].getInputNode(filter[0]);
        return null;
    },
    registerFilter: function (node, config, obj) {
        this._filter_elements[config.columnId] = [node, config, obj];
    },
    collectValues: function (id) {
        var values = [];
        var checks = { "": true };

        var obj = this.getColumnConfig(id);
        var options = obj.options || obj.collection;
        if (options) {
            if (typeof options == "object" && !options.loadNext) {
                //raw object
                if (smdui.isArray(options))
                    for (var i = 0; i < options.length; i++)
                        values.push({ id: options[i], value: options[i] });
                else
                    for (var key in options)
                        values.push({ id: key, value: options[key] });
                return values;
            } else {
                //view
                if (typeof options === "string")
                    options = smdui.$$(options);
                if (options.getBody)
                    options = options.getBody();

                this._collectValues.call(options, "id", "value", values, checks);
            }
        } else
            this._collectValues(obj.id, obj.id, values, checks);

        var obj = { values: values }; 
        this.callEvent("onCollectValues", [id, obj]);
        return obj.values;
    },
    _collectValues: function (id, value, values, checks) {
        this.data.each(function (obj) {
            var test = obj ? obj[id] : "";
            if (test !== smdui.undefined && !checks[test]) {
                checks[test] = true;
                values.push({ id: obj[id], value: obj[value] });
            }
        }, this, true);

        if (values.length) {
            var type = typeof values[0].value === "string" ? "string" : "raw";
            values.sort(this.data.sorting.create({ as: type, by: "value", dir: "asc" }));
        }
    },
    _runServerFilter: function (name) {
        this.loadNext(0, 0, {
            before: function () {
                if (this.editStop) this.editStop();
                this.clearAll(true);
            },
            success: function () {
                this.callEvent("onAfterFilter", []);
            }
        }, 0, 1);
    }
});

smdui.extend(smdui.ui.datatable, {
    hover_setter: function (value) {
        if (value && !this._hover_initialized) {
            this._enable_mouse_move();
            this.config.experimental = true;

            this.attachEvent("onMouseMoving", function (e) {

                var row = this.locate(arguments[0]);
                row = row ? row.row : null;

                if (this._last_hover != row) {
                    if (this._last_hover)
                        this.removeRowCss(this._last_hover, this._settings.hover);

                    this._delayed_hover_set();
                    this._last_hover = row;
                }
            });

            this.attachEvent("onMouseOut", function () {
                if (this._last_hover) {
                    this.removeRowCss(this._last_hover, this._settings.hover);
                    this._last_hover = null;
                }
            });

            this._hover_initialized = 1;
        }
        return value;
    },
    _delayed_hover_set: function () {
        smdui.delay(function () {
            if (this._last_hover)
                this.addRowCss(this._last_hover, this._settings.hover);
        }, this, [], 5);
    },
    select_setter: function (value) {
        if (!this.select && value) {
            smdui.extend(this, this._selections._commonselect, true);
            if (value === true)
                value = "row";
            else if (value == "multiselect") {
                value = "row";
                this._settings.multiselect = true;
            }
            smdui.assert(this._selections[value], "Unknown selection mode: " + value);
            smdui.extend(this, this._selections[value], true);
        }
        return value;
    },
    getSelectedId: function (mode) {
        return mode ? [] : ""; //dummy placeholder
    },
    getSelectedItem: function (mode) {
        return smdui.SelectionModel.getSelectedItem.call(this, mode);
    },
    _selections: {
        //shared methods for all selection models
        _commonselect: {
            _select_css: ' smdui_cell_select',
            $init: function () {
                this._reinit_selection();

                this.on_click.smdui_cell = smdui.bind(this._click_before_select, this);

                //temporary stab, actual handlers need to be created
                this._data_cleared = this._data_filtered = function () {
                    this.unselect();
                };

                this.data.attachEvent("onStoreUpdated", smdui.bind(this._data_updated, this));
                this.data.attachEvent("onSyncApply", smdui.bind(this._data_synced, this));
                this.data.attachEvent("onClearAll", smdui.bind(this._data_cleared, this));
                this.data.attachEvent("onAfterFilter", smdui.bind(this._data_filtered, this));
                this.data.attachEvent("onIdChange", smdui.bind(this._id_changed, this));

                this.$ready.push(smdui.SelectionModel._set_noselect);
            },
            _id_changed: function (oldid, newid) {
                for (var i = 0; i < this._selected_rows.length; i++)
                    if (this._selected_rows[i] == oldid)
                        this._selected_rows[i] = newid;

                for (var i = 0; i < this._selected_areas.length; i++) {
                    var item = this._selected_areas[i];
                    if (item.row == oldid) {
                        oldid = this._select_key(item);
                        item.row = newid;
                        newid = this._select_key(item);
                        item.id = newid;

                        delete this._selected_pull[oldid];
                        this._selected_pull[newid] = true;
                    }
                }
            },
            _data_updated: function (id, obj, type) {
                if (type == "delete")
                    this.unselect(id);
            },
            _data_synced: function () {
                for (var i = this._selected_areas.length - 1; i >= 0; i--) {
                    if (!this.exists(this._selected_areas[i].row))
                        this._selected_areas.splice(i, 1);
                }
            },
            _reinit_selection: function () {
                //list of selected areas
                this._selected_areas = [];
                //key-value hash of selected areas, for fast search
                this._selected_pull = {};
                //used to track selected cell objects
                this._selected_rows = [];
            },
            isSelected: function (id, column) {
                var key;
                if (!smdui.isUndefined(column))
                    key = this._select_key({ row: id, column: column });
                else
                    key = typeof id === "object" ? this._select_key(id) : id;

                return this._selected_pull[key];
            },
            getSelectedId: function (asArray, plain) {
                var result;

                //if multiple selections was created - return array
                //in case of single selection, return value or array, when asArray parameter provided
                if (this._selected_areas.length > 1 || asArray) {
                    result = [].concat(this._selected_areas);
                    if (plain)
                        for (var i = 0; i < result.length; i++)
                            result[i] = result[i].id;
                } else {
                    result = this._selected_areas[0];
                    if (plain && result)
                        return result.id;
                }

                return result;
            },
            _id_to_string: function () {
                return this.row;
            },
            _select: function (data, preserve) {
                var key = this._select_key(data);
                //don't allow selection on unnamed columns
                if (key === null) return;

                if (preserve === -1)
                    return this._unselect(data);

                data.id = key;
                data.toString = this._id_to_string;

                if (!this.callEvent("onBeforeSelect", [data, preserve])) return false;

                //ignore area, if it was already selected and
                // - we are preserving existing selection
                // - this is the only selected area
                // otherwise we need to clear other selected areas
                if (this._selected_pull[key] && (preserve || this._selected_areas.length == 1)) return;

                if (!preserve)
                    this._clear_selection();

                this._selected_areas.push(data);
                this._selected_pull[key] = true;

                this.callEvent("onAfterSelect", [data, preserve]);


                this._finalize_select(this._post_select(data));
                return true;
            },
            _clear_selection: function () {
                if (!this._selected_areas.length) return false;

                for (var i = 0; i < this._selected_areas.length; i++) {
                    if (!this.callEvent("onBeforeUnSelect", [this._selected_areas[i]])) return false;
                }

                for (var i = 0; i < this._selected_rows.length; i++)
                    this.data.removeMark(this._selected_rows[i], "smdui_selected");

                var cols = this._settings.columns;
                if (cols)
                    for (var i = 0; i < cols.length; i++) {
                        cols[i].$selected = null;
                    }

                var data = this._selected_areas;
                this._reinit_selection();
                for (var i = 0; i < data.length; i++) {
                    this.callEvent("onAfterUnSelect", [data[i]]);
                }
                return true;
            },
            unselectAll: function () {
                this.clearSelection();
            },
            selectAll: function () {
                this.selectRange();
            },
            clearSelection: function () {
                if (this._clear_selection()) {
                    this.callEvent("onSelectChange", []);
                    this.render();
                }
            },
            _unselect: function (data) {
                var key = this._select_key(data);
                if (!key && this._selected_areas.length) {
                    this.clearSelection();
                    this.callEvent("onSelectChange", []);
                }

                //ignore area, if it was already selected
                if (!this._selected_pull[key]) return;

                if (!this.callEvent("onBeforeUnSelect", [data])) return false;

                for (var i = 0; i < this._selected_areas.length; i++) {
                    if (this._selected_areas[i].id == key) {
                        this._selected_areas.splice(i, 1);
                        break;
                    }
                }

                delete this._selected_pull[key];

                this.callEvent("onAfterUnSelect", [data]);
                this._finalize_select(0, this._post_unselect(data));
            },
            _add_item_select: function (id) {
                var item = this.getItem(id);
                return this.data.addMark(item.id, "smdui_selected", 0, { $count: 0 }, true);

            },
            _finalize_select: function (id) {
                if (id)
                    this._selected_rows.push(id);
                if (!this._silent_selection) {
                    this.render();
                    this.callEvent("onSelectChange", []);
                }
            },
            _click_before_select: function (e, id) {
                var preserve = e.ctrlKey || e.metaKey || (this._settings.multiselect == "touch");
                var range = e.shiftKey;

                if (!this._settings.multiselect && this._settings.select != "multiselect")
                    preserve = range = false;

                if (range && this._selected_areas.length) {
                    var last = this._selected_areas[this._selected_areas.length - 1];
                    this._selectRange(id, last);
                } else {
                    if (preserve && this._selected_pull[this._select_key(id)])
                        this._unselect(id);
                    else
                        this._select({ row: id.row, column: id.column }, preserve);
                }
            },
            _mapSelection: function (callback, column, row) {
                var cols = this._settings.columns;
                //selected columns only
                if (column) {
                    var temp = [];
                    for (var i = 0; i < cols.length; i++)
                        if (cols[i].$selected)
                            temp.push(cols[i]);
                    cols = temp;
                }

                var rows = this.data.order;
                var row_ind = 0;

                for (var i = 0; i < rows.length; i++) {
                    var item = this.getItem(rows[i]);
                    if (!item) continue; //dyn loading, row is not available
                    var selection = this.data.getMark(item.id, "smdui_selected");
                    if (selection || column) {
                        var col_ind = 0;
                        for (var j = 0; j < cols.length; j++) {
                            var id = cols[j].id;
                            if (row || column || selection[id]) {
                                if (callback)
                                    item[id] = callback(item[id], rows[i], id, row_ind, col_ind);
                                else
                                    return { row: rows[i], column: id };
                                col_ind++;
                            }
                        }
                        //use separate row counter, to count only selected rows
                        row_ind++;
                    }
                }
            }
        },

        row: {
            _select_css: ' smdui_row_select',
            _select_key: function (data) { return data.row; },
            select: function (row_id, preserve) {
                //when we are using id from mouse events
                if (row_id) row_id = row_id.toString();

                smdui.assert(this.data.exists(row_id), "Incorrect id in select command: " + row_id);
                this._select({ row: row_id }, preserve);
            },
            _post_select: function (data) {
                this._add_item_select(data.row).$row = true;
                return data.row;
            },
            unselect: function (row_id) {
                this._unselect({ row: row_id });
            },
            _post_unselect: function (data) {
                this.data.removeMark(data.row, "smdui_selected", 0, 1);
                return data.row;
            },
            mapSelection: function (callback) {
                return this._mapSelection(callback, false, true);
            },
            _selectRange: function (a, b) {
                return this.selectRange(a.row, b.row);
            },
            selectRange: function (row_id, end_row_id, preserve) {
                if (smdui.isUndefined(preserve)) preserve = true;

                var row_start_ind = row_id ? this.getIndexById(row_id) : 0;
                var row_end_ind = end_row_id ? this.getIndexById(end_row_id) : this.data.order.length - 1;

                if (row_start_ind > row_end_ind) {
                    var temp = row_start_ind;
                    row_start_ind = row_end_ind;
                    row_end_ind = temp;
                }

                this._silent_selection = true;
                for (var i = row_start_ind; i <= row_end_ind; i++) {
                    var id = this.getIdByIndex(i);
                    if (!id) {
                        if (row_id)
                            this.select(row_id);
                        break;
                    }
                    this.select(id, preserve);
                }

                this._silent_selection = false;
                this._finalize_select();
            }
        },

        cell: {
            _select_key: function (data) {
                if (!data.column) return null;
                return data.row + "_" + data.column;
            },
            select: function (row_id, column_id, preserve) {
                smdui.assert(this.data.exists(row_id), "Incorrect id in select command: " + row_id);
                this._select({ row: row_id, column: column_id }, preserve);
            },
            _post_select: function (data) {
                var sel = this._add_item_select(data.row);
                sel.$count++;
                sel[data.column] = true;
                return data.row;
            },
            unselect: function (row_id, column_id) {
                this._unselect({ row: row_id, column: column_id });
            },
            _post_unselect: function (data) {
                var sel = this._add_item_select(data.row);
                sel.$count--;
                sel[data.column] = false;
                if (sel.$count <= 0)
                    this.data.removeMark(data.row, "smdui_selected");
                return data.row;
            },
            mapSelection: function (callback) {
                return this._mapSelection(callback, false, false);
            },
            _selectRange: function (a, b) {
                return this.selectRange(a.row, a.column, b.row, b.column);
            },

            selectRange: function (row_id, column_id, end_row_id, end_column_id, preserve) {
                if (smdui.isUndefined(preserve)) preserve = true;

                var row_start_ind = row_id ? this.getIndexById(row_id) : 0;
                var row_end_ind = end_row_id ? this.getIndexById(end_row_id) : this.data.order.length - 1;

                var col_start_ind = column_id ? this.getColumnIndex(column_id) : 0;
                var col_end_ind = end_column_id ? this.getColumnIndex(end_column_id) : this._columns.length - 1;

                if (row_start_ind > row_end_ind) {
                    var temp = row_start_ind;
                    row_start_ind = row_end_ind;
                    row_end_ind = temp;
                }

                if (col_start_ind > col_end_ind) {
                    var temp = col_start_ind;
                    col_start_ind = col_end_ind;
                    col_end_ind = temp;
                }

                this._silent_selection = true;
                for (var i = row_start_ind; i <= row_end_ind; i++)
                    for (var j = col_start_ind; j <= col_end_ind; j++)
                        this.select(this.getIdByIndex(i), this.columnId(j), preserve);
                this._silent_selection = false;
                this._finalize_select();
            }
        },

        column: {
            _select_css: ' smdui_column_select',
            _select_key: function (data) { return data.column; },
            _id_to_string: function () {
                return this.column;
            },
            //returns box-like area, with ordered selection cells
            select: function (column_id, preserve) {
                this._select({ column: column_id }, preserve);
            },
            _post_select: function (data) {
                this._settings.columns[this.getColumnIndex(data.column)].$selected = true;
                if (!this._silent_selection)
                    this._render_header_and_footer();
            },
            unselect: function (column_id) {
                this._unselect({ column: column_id });
            },
            _post_unselect: function (data) {
                this._settings.columns[this.getColumnIndex(data.column)].$selected = null;
                this._render_header_and_footer();
            },
            mapSelection: function (callback) {
                return this._mapSelection(callback, true, false);
            },
            _selectRange: function (a, b) {
                return this.selectRange(a.column, b.column);
            },
            selectRange: function (column_id, end_column_id, preserve) {
                if (smdui.isUndefined(preserve)) preserve = true;

                var column_start_ind = column_id ? this.getColumnIndex(column_id) : 0;
                var column_end_ind = end_column_id ? this.getColumnIndex(end_column_id) : this._columns.length - 1;

                if (column_start_ind > column_end_ind) {
                    var temp = column_start_ind;
                    column_start_ind = column_end_ind;
                    column_end_ind = temp;
                }

                this._silent_selection = true;
                for (var i = column_start_ind; i <= column_end_ind; i++)
                    this.select(this.columnId(i), preserve);

                this._silent_selection = false;

                this._render_header_and_footer();
                this._finalize_select();
            },
            _data_synced: function () {
                //do nothing, as columns are not changed
            }
        },
        area: {
            _select_key: function (data) {
                return data.row + "_" + data.column;
            },
            getSelectedId: function (asArray) {
                var area = this.getSelectArea();
                var result = [];
                if (area) {
                    if (asArray && (area.start.row != area.end.row || area.start.column != area.end.column)) {
                        var row_start_ind = this.getIndexById(area.start.row);
                        var row_end_ind = this.getIndexById(area.end.row);
                        //filtering in process
                        if (row_start_ind == -1 || row_end_ind == -1)
                            return result;

                        var col_start_ind = this.getColumnIndex(area.start.column);
                        var col_end_ind = this.getColumnIndex(area.end.column);

                        for (var i = row_start_ind; i <= row_end_ind; i++)
                            for (var j = col_start_ind; j <= col_end_ind; j++)
                                result.push({ row: this.getIdByIndex(i), column: this.columnId(j) });
                    }
                    else {
                        result.push(area.end);
                    }
                }

                return asArray ? result : result[0];
            },
            unselect: function (row_id) {
                this._unselect();
            },
            _unselect: function () {
                this.removeSelectArea();
                this.callEvent("onSelectChange", []);
            },
            mapSelection: function (callback) {
                var select = this.getSelectArea();
                if (select) {
                    var sind = this.getColumnIndex(select.start.column);
                    var eind = this.getColumnIndex(select.end.column);
                    var srow = this.getIndexById(select.start.row);
                    var erow = this.getIndexById(select.end.row);

                    for (var i = srow; i <= erow; i++) {
                        var rid = this.data.order[i];
                        var item = this.getItem(rid);
                        for (var j = sind; j <= eind; j++) {
                            var cid = this._columns[j].id;
                            if (callback)
                                callback((item[cid] || ""), rid, cid, i - srow, j - sind);
                            else
                                return { row: rid, column: cid };
                        }
                    }

                }
            },
            select: function (row_id, column_id, preserve) {
                smdui.assert(this.data.exists(row_id), "Incorrect id in select command: " + row_id);
                this._select({ row: row_id, column: column_id }, preserve);
            },
            _selectRange: function (id, last) {
                this._extendAreaRange(id, last);
            },
            _select: function (cell, preserve) {
                //ctrl-selection is not supported yet, so ignoring the preserve flag
                this.addSelectArea(cell, cell, false);
                return true;
            },
            _data_synced: function () {
                if (this._selected_areas.length)
                    this.refreshSelectArea();
            }
        }
    }
});

smdui.extend(smdui.ui.datatable, {
    blockselect_setter: function (value) {
        if (value && this._block_sel_flag) {
            smdui._event(this._viewobj, smdui.env.mouse.move, this._bs_move, { bind: this });
            smdui._event(this._viewobj, smdui.env.mouse.down, this._bs_down, { bind: this });
            smdui.event(document.body, smdui.env.mouse.up, this._bs_up, { bind: this });
            this._block_sel_flag = this._bs_ready = this._bs_progress = false;
            this.attachEvent("onAfterScroll", function () {
                this._update_block_selection();
            });
            // auto scroll
            smdui.extend(this, smdui.AutoScroll, true);
            this.attachEvent("onBeforeAutoScroll", function () {
                return this._bs_progress;
            });
        }
        return value;
    },
    _block_sel_flag: true,
    _childOf: function (e, tag) {
        var src = e.target || e.srcElement;
        while (src) {
            if (src.getAttribute && src.getAttribute("smduiignore")) return false;
            if (src == tag)
                return true;
            src = src.parentNode;
        }
        return false;
    },
    _bs_down: function (e) {
        // do not listen to mousedown of subview on master
        if (this._settings.subview && this != smdui.$$(e.target || e.srcElement)) return;
        if (this._childOf(e, this._body)) {
            //disable block selection when we have an active editor
            if (e.target && e.target.tagName == "INPUT" || this._rs_process) return;

            smdui.html.addCss(document.body, "smdui_noselect");
            this._bs_position = smdui.html.offset(this._body);
            var pos = smdui.html.pos(e);
            this._bs_ready = [pos.x - this._bs_position.x, pos.y - this._bs_position.y];
        }
    },
    _bs_up: function (e) {
        if (this._block_panel) {
            this._bs_select("select", true, e);
            this._block_panel = smdui.html.remove(this._block_panel);
        }
        smdui.html.removeCss(document.body, "smdui_noselect");
        this._bs_ready = this._bs_progress = false;
        if (this._auto_scroll_delay)
            this._auto_scroll_delay = window.clearTimeout(this._auto_scroll_delay);
    },
    _update_block_selection: function () {
        if (this._bs_progress)
            this._bs_select(false, false);
    },
    _bs_select: function (mode, theend, e) {
        var start = null;
        if (!this._bs_ready[2])
            this._bs_ready[2] = this._locate_cell_xy.apply(this, this._bs_ready);
        start = this._bs_ready[2];

        var end = this._locate_cell_xy.apply(this, this._bs_progress);

        if (!this.callEvent("onBeforeBlockSelect", [start, end, theend, e]))
            return;

        if ((!this._bs_do_select || this._bs_do_select(start, end, theend, e) !== false) && (start.row && end.row)) {
            if (mode === "select") {
                this._clear_selection();
                this._selectRange(start, end);
            } else {
                var startx, starty, endx, endy;

                if (mode === "box") {
                    startx = Math.min(this._bs_ready[0], this._bs_progress[0]);
                    endx = Math.max(this._bs_ready[0], this._bs_progress[0]);

                    starty = Math.min(this._bs_ready[1], this._bs_progress[1]);
                    endy = Math.max(this._bs_ready[1], this._bs_progress[1]);
                } else {
                    var startn = this._cellPosition(start.row, start.column);
                    var endn = this._cellPosition(end.row, end.column);
                    var scroll = this.getScrollState();

                    var startWidth = startn.width;
                    var endWidth = endn.width;

                    if (this._right_width && this._bs_ready[0] > this._left_width + this._center_width) {
                        startn.left += this._left_width + this._center_width;
                    } else if (this._left_width) {

                        if (this._bs_ready[0] > this._left_width) {
                            if (startn.left < scroll.x) {
                                startWidth -= scroll.x - startn.left;
                                startn.left = this._left_width;
                            }
                            else
                                startn.left += this._left_width - scroll.x;

                        }

                    } else startn.left -= scroll.x;



                    if (this._right_width && this._bs_progress[0] > this._left_width + this._center_width) {
                        endn.left += this._left_width + this._center_width;
                    } else if (this._left_width) {
                        if (this._bs_progress[0] > this._left_width) {
                            if (endn.left < scroll.x) {
                                endWidth -= scroll.x - endn.left;
                                endn.left = this._left_width;
                            }

                            else
                                endn.left += this._left_width - scroll.x;
                        }
                    } else endn.left -= scroll.x;

                    if (this._settings.prerender) {
                        startn.top -= this._scrollTop;
                        endn.top -= this._scrollTop;
                    }


                    startx = Math.min(startn.left, endn.left);
                    endx = Math.max(startn.left + startWidth, endn.left + endWidth);

                    starty = Math.min(startn.top, endn.top);
                    endy = Math.max(startn.top + startn.height, endn.top + endn.height);

                    if (this._settings.topSplit)
                        starty += this._getTopSplitOffset(start);

                    if (this._auto_scroll_delay)
                        this._auto_scroll_delay = window.clearTimeout(this._auto_scroll_delay);
                    if (e)
                        this._auto_scroll_delay = smdui.delay(this._auto_scroll, this, [smdui.html.pos(e)], 250);
                }


                var style = this._block_panel.style;
                style.left = startx + "px";
                style.top = starty + "px";
                style.width = (endx - startx) + "px";
                style.height = (endy - starty) + "px";

            }
        }

        if (theend)
            this.callEvent("onAfterBlockSelect", [start, end]);
    },
    _bs_start: function (e) {
        this._block_panel = smdui.html.create("div", { "class": "smdui_block_selection" }, "");

        this._body.appendChild(this._block_panel);
    },
    _bs_move: function (e) {
        if (this._bs_ready !== false) {
            var pos = smdui.html.pos(e);
            var progress = [pos.x - this._bs_position.x, pos.y - this._bs_position.y];

            //prevent unnecessary block selection while dbl-clicking
            if (Math.abs(this._bs_ready[0] - progress[0]) < 5 && Math.abs(this._bs_ready[1] - progress[1]) < 5)
                return;

            if (this._bs_progress === false)
                this._bs_start(e);

            this._bs_progress = progress;
            this._bs_select(this.config.blockselect, false, e);
        }
    },
    _locate_cell_xy: function (x, y) {
        var inTopSplit = false,
            row = null,
            column = null;


        if (this._right_width && x > this._left_width + this._center_width)
            x += this._x_scroll.getSize() - this._center_width - this._left_width - this._right_width;
        else if (!this._left_width || x > this._left_width)
            x += this._x_scroll.getScroll();

        if (this._settings.topSplit && this._render_scroll_top > this._settings.topSplit) {
            var splitPos = this._cellPosition(this.getIdByIndex(this._settings.topSplit - 1), this.columnId(0));
            if (splitPos.top + splitPos.height > y) {
                inTopSplit = true;
            }
        }
        if (!inTopSplit)
            y += this.getScrollState().y;

        if (x < 0) x = 0;
        if (y < 0) y = 0;

        var cols = this._settings.columns;
        var rows = this.data.order;

        var summ = 0;
        for (var i = 0; i < cols.length; i++) {
            summ += cols[i].width;
            if (summ >= x) {
                column = cols[i].id;
                break;
            }
        }
        if (!column)
            column = cols[cols.length - 1].id;

        summ = 0;

        var start = this.data.$min || 0;
        if (this._settings.fixedRowHeight) {
            row = rows[start + Math.floor(y / this._settings.rowHeight)];
        } else for (var i = start; i < rows.length; i++) {
            summ += this._getHeightByIndex(i);
            if (summ >= y) {
                row = rows[i];
                break;
            }
        }
        if (!row)
            row = rows[rows.length - 1];

        return { row: row, column: column };
    },
    _getTopSplitOffset: function (cell, area) {
        var y = 0,
            startIndex = this.getIndexById(cell.row);

        if (startIndex >= this._settings.topSplit) {
            var startPos = this._cellPosition(this.getIdByIndex(startIndex), cell.column);
            var splitPos = this._cellPosition(this.getIdByIndex(this._settings.topSplit - 1), cell.column);
            if (splitPos.top + splitPos.height - startPos.top > 0) {
                y = splitPos.top + splitPos.height - (startPos.top > 0 || !area ? startPos.top : 0);
            }
        }

        return y;
    }
});

smdui.extend(smdui.ui.datatable, {
    resizeRow_setter: function (value) {
        this._settings.scrollAlignY = false;
        this._settings.fixedRowHeight = false;
        return this.resizeColumn_setter(value);
    },
    resizeColumn_setter: function (value) {
        if (value && this._rs_init_flag) {
            smdui._event(this._viewobj, "mousemove", this._rs_move, { bind: this });
            smdui._event(this._viewobj, "mousedown", this._rs_down, { bind: this });
            smdui._event(this._viewobj, "mouseup", this._rs_up, { bind: this });
            this._rs_init_flag = false;
        }
        return value;
    },
    _rs_init_flag: true,
    _rs_down: function (e) {
        // do not listen to mousedown of subview on master
        if (this._settings.subview && this != smdui.$$(e.target || e.srcElement)) return;
        //if mouse was near border
        if (!this._rs_ready) return;
        this._rs_process = [smdui.html.pos(e), this._rs_ready[2]];
        smdui.html.addCss(document.body, "smdui_noselect");
        smdui.html.denySelect();
    },
    _rs_up: function () {
        this._rs_process = false;
        smdui.html.removeCss(document.body, "smdui_noselect");
        smdui.html.allowSelect();
    },
    _rs_start: function (e) {
        e = e || event;
        if (this._rs_progress)
            return;
        var dir = this._rs_ready[0];
        var node = this._rs_process[1];
        var obj = this._locate(node);
        if (!obj) return;

        var eventPos = this._rs_process[0];
        var start;

        if (dir == "x") {
            start = smdui.html.offset(node).x + this._rs_ready[1] - smdui.html.offset(this._body).x;
            eventPos = eventPos.x;
            if (!this._rs_ready[1]) obj.cind -= (node.parentNode.colSpan || 1);
        } else {
            start = smdui.html.offset(node).y + this._rs_ready[1] - smdui.html.offset(this._body).y + this._header_height;
            eventPos = eventPos.y;
            if (!this._rs_ready[1]) obj.rind--;
        }
        if (obj.cind >= 0 && obj.rind >= 0) {
            this._rs_progress = [dir, obj, start];

            var resize = new smdui.ui.resizearea({
                container: this._viewobj,
                dir: dir,
                eventPos: eventPos,
                start: start,
                cursor: (dir == "x" ? "col" : "row") + "-resize"
            });
            resize.attachEvent("onResizeEnd", smdui.bind(this._rs_end, this));
        }
        this._rs_down = this._rs_ready = false;
    },
    _rs_end: function (result) {
        if (this._rs_progress) {
            var dir = this._rs_progress[0];
            var obj = this._rs_progress[1];
            var newsize = result - this._rs_progress[2];
            if (dir == "x") {

                //in case of right split - different sizing logic applied
                if (this._settings.rightSplit && obj.cind + 1 >= this._rightSplit &&
                    obj.cind !== this._columns.length - 1) {
                    obj.cind++;
                    newsize *= -1;
                }

                var column = this._columns[obj.cind];
                var oldwidth = column.width;
                delete column.fillspace;
                delete column.adjust;
                this._setColumnWidth(obj.cind, oldwidth + newsize, true, true);
                this._updateColsSizeSettings();
            }
            else {
                var rid = this.getIdByIndex(obj.rind);
                var oldheight = this._getRowHeight(this.getItem(rid));
                this.setRowHeight(rid, oldheight + newsize);
            }
            this._rs_up();
        }
        this._rs_progress = null;
    },
    _rs_move: function (e) {
        var cell = null,
            config = this._settings;
        if (this._rs_ready && this._rs_process)
            return this._rs_start(e);

        e = e || event;
        var node = e.target || e.srcElement;
        var mode = false; //resize ready flag

        if (node.tagName == "TD" || node.tagName == "TABLE") return;
        var element_class = node.className || "";
        var in_body = typeof element_class === "string" && element_class.indexOf("smdui_cell") != -1;
        //ignore resize in case of drag-n-drop enabled
        if (in_body && config.drag) return;
        var in_header = typeof element_class === "string" && element_class.indexOf("smdui_hcell") != -1;
        this._rs_ready = false;

        if (in_body || in_header) {
            var dx = node.offsetWidth;
            var dy = node.offsetHeight;
            var pos = smdui.html.posRelative(e);

            var resizeRow = config.resizeRow;
            // if resize is only within the first column
            if (typeof resizeRow == "object" && resizeRow.headerOnly) {
                cell = this._locate(node);
                if (cell.cind > 0)
                    resizeRow = false;
            }

            if (in_body && resizeRow) {
                resizeRow = (typeof resizeRow == "object" && resizeRow.size ? resizeRow.size : 3);
                if (pos.y < resizeRow) {
                    if (!cell)
                        cell = this._locate(node);
                    // avoid resize header border
                    if (cell.rind) {
                        this._rs_ready = ["y", 0, node];
                        mode = "row-resize";
                    }
                } else if (dy - pos.y < resizeRow + 1) {
                    this._rs_ready = ["y", dy, node];
                    mode = "row-resize";
                }
            }

            var resizeColumn = config.resizeColumn;
            // if resize is only within the header
            if (typeof resizeColumn == "object" && resizeColumn.headerOnly && in_body)
                resizeColumn = false;

            if (resizeColumn) {
                resizeColumn = (typeof resizeColumn == "object" && resizeColumn.size ? resizeColumn.size : 3);

                if (pos.x < resizeColumn) {
                    this._rs_ready = ["x", 0, node];
                    mode = "col-resize";
                } else if (dx - pos.x < resizeColumn + 1) {
                    this._rs_ready = ["x", dx, node];
                    mode = "col-resize";
                }
            }
        }

        //mark or unmark resizing ready state
        if (this._cursor_timer) window.clearTimeout(this._cursor_timer);
        this._cursor_timer = smdui.delay(this._mark_resize_ready, this, [mode], mode ? 100 : 0);
    },

    _mark_resize_ready: function (mode) {
        if (this._last_cursor_mode != mode) {
            this._last_cursor_mode = mode;
            this._viewobj.style.cursor = mode || "default";
        }
    }
});

smdui.extend(smdui.ui.datatable, smdui.PagingAbility);

smdui.TablePaste = {
    clipboard_setter: function (value) {
        if (value === true || value === 1) this._settings.clipboard = 'block';
        smdui.clipbuffer.init();
        this.attachEvent("onSelectChange", this._sel_to_clip);
        // solution for clicks on selected items
        this.attachEvent("onItemClick", function (id, e, node) {
            if (document.activeElement && this.$view.contains(document.activeElement)) {
                smdui.clipbuffer.focus();
                smdui.UIManager.setFocus(this);
            }
        });
        this.attachEvent("onPaste", this._clip_to_sel);

        return value;
    },
    templateCopy_setter: smdui.template,
    _sel_to_clip: function () {
        if (!this.getEditor || !this.getEditor()) {
            var data = this._get_sel_text();
            smdui.clipbuffer.set(data);
            smdui.UIManager.setFocus(this);
        }
    },

    _get_sel_text: function () {
        var data = [];
        var filter = this._settings.templateCopy;
        this.mapSelection(function (value, row, col, row_ind, col_ind) {
            if (!data[row_ind]) data[row_ind] = [];
            var newvalue = filter ? filter(value, row, col) : value;
            data[row_ind].push(newvalue);
            return value;
        });

        return smdui.csv.stringify(data, this._settings.delimiter);
    },

    _clip_to_sel: function (text) {
        if (!smdui.isUndefined(this._paste[this._settings.clipboard])) {
            var data = smdui.csv.parse(text, this._settings.delimiter);
            this._paste[this._settings.clipboard].call(this, data);
        }
    },

    _paste: {
        block: function (data) {
            var leftTop = this.mapSelection(null);
            if (!leftTop) return;

            // filling cells with data
            this.mapCells(leftTop.row, leftTop.column, data.length, null, function (value, row, col, row_ind, col_ind) {
                if (data[row_ind] && data[row_ind].length > col_ind) {
                    return data[row_ind][col_ind];
                }
                return value;
            });
            this.render();
        },

        selection: function (data) {
            this.mapSelection(function (value, row, col, row_ind, col_ind) {
                if (data[row_ind] && data[row_ind].length > col_ind)
                    return data[row_ind][col_ind];
                return value;
            });
            this.render();
        },

        repeat: function (data) {
            this.mapSelection(function (value, row, col, row_ind, col_ind) {
                row = data[row_ind % data.length];
                value = row[col_ind % row.length];
                return value;
            });
            this.render();
        },

        custom: function (text) { }
    }
};

smdui.extend(smdui.ui.datatable, smdui.TablePaste);

smdui.DataState = {
    getState: function () {
        var cols_n = this.config.columns.length;
        var columns = this.config.columns;
        var settings = {
            ids: [],
            size: [],
            select: this.getSelectedId(true),
            scroll: this.getScrollState()
        };
        for (var i = 0; i < cols_n; i++) {
            var col = columns[i];
            settings.ids.push(col.id);
            settings.size.push((col.fillspace || col.adjust) ? -1 : col.width);
        }

        settings.order = [].concat(this._hidden_column_order.length ? this._hidden_column_order : settings.ids);

        if (this._last_sorted) {
            settings.sort = {
                id: this._last_sorted,
                dir: this._last_order
            };
        }

        //this method will try to access the rendered values
        //just ignore it if grid is not rendered yet
        if (this._filter_elements && this._dtable_fully_ready) {
            var filter = {};
            var any_filter = 0;
            for (var key in this._filter_elements) {
                if (this._hidden_column_hash[key]) continue;

                var f = this._filter_elements[key];
                f[1].value = filter[key] = f[2].getValue(f[0]);
                any_filter = 1;
            }
            if (any_filter)
                settings.filter = filter;
        }

        settings.hidden = [];
        for (var key in this._hidden_column_hash)
            settings.hidden.push(key);

        return settings;
    },
    setState: function (obj) {
        var columns = this.config.columns;
        if (!obj) return;

        this._last_sorted = null;
        this.blockEvent();

        if (obj.hidden) {
            var hihash = {};
            for (var i = 0; i < obj.hidden.length; i++) {
                hihash[obj.hidden[i]] = true;
                if (!this._hidden_column_order.length)
                    this.hideColumn(obj.hidden[i]);
            }

            if (this._hidden_column_order.length) {
                for (var i = 0; i < this._hidden_column_order.length; i++) {
                    var hikey = this._hidden_column_order[i];
                    if (!!hihash[hikey] == !this._hidden_column_hash[hikey])
                        this.hideColumn(hikey, !!hihash[hikey]);
                }
            }
        }

        if (obj.ids) {
            var reorder = false;
            var cols = this.config.columns;
            for (var i = 0; i < cols.length; i++)
                if (cols[i].id != obj.ids[i])
                    reorder = true;
            if (reorder) {
                for (var i = 0; i < obj.ids.length; i++)
                    cols[i] = this.getColumnConfig(obj.ids[i]) || cols[i];
                this.refreshColumns();
            }
        }

        if (obj.size) {
            var cols_n = Math.min(obj.size.length, columns.length);
            for (var i = 0; i < cols_n; i++) {
                var col = columns[i];
                if (col && obj.size[i] > 0 && col.width != obj.size[i]) {
                    delete col.fillspace;
                    delete col.adjust;
                    this._setColumnWidth(i, obj.size[i], true);
                }
            }
        }

        this.unblockEvent();

        var silent = !(this._settings.leftSplit || this._settings.rightSplit);
        this._updateColsSizeSettings(silent);
        this.callEvent("onStructureUpdate", []);

        if (obj.sort) {
            var column = columns[this.getColumnIndex(obj.sort.id)];
            if (column)
                this._sort(obj.sort.id, obj.sort.dir, column.sort);
        }

        if (obj.filter) {
            //temporary disable filtering 
            var temp = this.filterByAll;
            this.filterByAll = function () { };

            //apply defined filters
            for (var key in obj.filter) {
                var value = obj.filter[key];
                if (!value) continue;

                if (!this._filter_elements[key]) continue;
                var f = this._filter_elements[key];
                f[2].setValue(f[0], value);
                var contentid = f[1].contentId;
                if (contentid)
                    this._active_headers[contentid].value = value;
            }

            //remove old filters
            for (var key in this._filter_elements) {
                if (!obj.filter[key]) {
                    var f = this._filter_elements[key];
                    f[2].setValue(f[0], "");
                }
            }

            //restore and apply filtering
            this.filterByAll = temp;
            this.filterByAll();
        }

        if (obj.select && this.select) {
            var select = obj.select;
            this.unselect();
            for (var i = 0; i < select.length; i++)
                if (!select[i].row || this.exists(select[i].row))
                    this._select(select[i], true);
        }

        if (obj.scroll)
            this.scrollTo(obj.scroll.x, obj.scroll.y);
    }
};

smdui.extend(smdui.ui.datatable, smdui.DataState);

smdui.attachEvent("onDataTable", function (table, config) {
    if (smdui.env.touch) {
        smdui.Touch.$init();
        config.scrollSize = 0;

        // needed to show datatable scroll
        if (smdui.Touch._disabled)
            smdui.Touch.limit();

        table.$ready.push(table.$touch);
    }
});

smdui.extend(smdui.ui.datatable, {
    $touch: function () {
        var config = this._settings;
        config.scrollAlignY = false;

        smdui.extend(this, (config.prerender === true) ? this._touchNative : this._touch);

        var scrollMode = "";
        if (!config.autowidth && config.scrollX !== false)
            scrollMode += "x";
        if (!config.autoheight && config.scrollY !== false)
            scrollMode += "y";
        this._body.setAttribute("touch_scroll", scrollMode);

        smdui.Touch._init_scroll_node(this._body.childNodes[1].firstChild);
        smdui.Touch._set_matrix(this._body.childNodes[1].firstChild, 0, 0, "0ms");
        this._sync_scroll(0, 0, "0ms");
    },
    _touchNative: {
        _scrollTo_touch: function (x, y) {
            smdui.Touch._set_matrix(this._body.childNodes[1].firstChild, 0, 0, "0ms");
            this._sync_scroll(x, y, "0ms");
        },
        _getScrollState_touch: function () {
            var temp = smdui.Touch._get_matrix(this._body.childNodes[1].firstChild);
            return { x: -temp.e, y: -temp.f };
        },
        $init: function () {
            this.attachEvent("onBeforeScroll", function () {
                smdui.Touch._scroll_node = this._body.childNodes[1].firstChild;
                smdui.Touch._get_sizes(smdui.Touch._scroll_node);
                smdui.Touch._scroll_master = this;
            });
            this.attachEvent("onTouchEnd", function () {
                smdui.Touch._scroll_master = null;
            });
        },
        _sync_scroll: function (x, y, t) {
            if (this._settings.leftSplit)
                smdui.Touch._set_matrix(this._body.childNodes[0].firstChild, 0, y, t);
            if (this._settings.rightSplit)
                smdui.Touch._set_matrix(this._body.childNodes[2].firstChild, 0, y, t);
            if (this._settings.header)
                smdui.Touch._set_matrix(this._header.childNodes[1].firstChild, x, 0, t);
            if (this._settings.footer)
                smdui.Touch._set_matrix(this._footer.childNodes[1].firstChild, x, 0, t);

            this.callEvent("onSyncScroll", [x, y, t]);
        },
        _sync_pos: function () { }
    },
    _touch: {
        _scrollTo_touch: function (x, y) {
            smdui.delay(function () {
                this.callEvent("onAfterScroll", [{ e: -x, f: -y }]);
            }, this);

        },
        $scroll: {
            gravity: 0,
            elastic: false
        },
        $init: function () {
            //if the result column's width < container's width,
            this.attachEvent("onAfterColumnHide", function () {
                this._scrollTo_touch(0, 0);
            });
            this.attachEvent("onBeforeScroll", function () {
                var t = smdui.Touch;
                t._scroll_node = this._body.childNodes[1].firstChild;
                t._get_sizes(t._scroll_node);
                t._scroll_stat.left = this._scrollLeft;
                t._scroll_stat.hidden = this._x_scroll._settings.scrollVisible || this._y_scroll._settings.scrollVisible;
                t._scroll_stat.dy = this._dtable_height;
                t._scroll_master = this;
            });
            this.attachEvent("onAfterScroll", function (result) {
                //onAfterScroll may be triggered by some non-touch related logic
                if (!result) return;

                var isScrollX = (this._scrollLeft != -result.e);
                var isScrollY = (this._scrollTop != -result.f);

                smdui.Touch._scroll_master = null;
                smdui.Touch._fix_f = null;

                this._scrollTop = 0;
                this._scrollLeft = 0;

                //ipad can delay content rendering if 3d transformation applied
                //switch back to 2d
                var temp = smdui.Touch.config.translate;
                smdui.Touch.config.translate = "translate";
                this._sync_scroll((this._x_scroll ? 0 : result.e), 0, "0ms");
                smdui.Touch.config.translate = temp;

                this._scrollLeft = -result.e;
                this._scrollTop = -result.f;
                this._correctScrollSize();

                this.render();

                if (isScrollX) {
                    if (this._x_scroll)
                        this._x_scroll.scrollTo(this._scrollLeft);
                    this.callEvent("onScrollX", []);
                }
                if (isScrollY) {
                    if (this._y_scroll)
                        this._y_scroll.scrollTo(this._scrollTop);
                    this.callEvent("onScrollY", []);
                }

                return false;
            });
        },
        _sync_scroll: function (x, y, t) {
            y += this._scrollTop;
            x += this._scrollLeft;

            smdui.Touch._set_matrix(this._body.childNodes[1].firstChild, x, y, t);
            if (this._settings.leftSplit)
                smdui.Touch._set_matrix(this._body.childNodes[0].firstChild, 0, y, t);
            if (this._settings.rightSplit)
                smdui.Touch._set_matrix(this._body.childNodes[2].firstChild, 0, y, t);
            if (this._settings.header)
                smdui.Touch._set_matrix(this._header.childNodes[1].firstChild, x, 0, t);
            if (this._settings.footer)
                smdui.Touch._set_matrix(this._footer.childNodes[1].firstChild, x, 0, t);

            this.callEvent("onSyncScroll", [x, y, t]);
        },
        _sync_pos: function (matrix) {
            matrix.f -= this._scrollTop;
            matrix.e -= this._scrollLeft;
        }
    }
});
smdui.extend(smdui.ui.datatable, {
    $init: function () {
        this.data.attachEvent("onStoreUpdated", smdui.bind(function (id) {
            if (!id) this._adjustColumns();
        }, this));
        this.attachEvent("onStructureLoad", this._adjustColumns);

        this.attachEvent("onStructureUpdate", this._resizeColumns);
        this.attachEvent("onColumnResize", function (a, b, c, user) {
            if (user)
                this._resizeColumns();
        });
        this.attachEvent("onResize", this._resizeColumns);
    },
    _adjustColumns: function () {
        var resize = false;
        var cols = this._columns;
        for (var i = 0; i < cols.length; i++)
            if (cols[i].adjust && (cols[i].adjust == "header" || this.count()))
                resize = this._adjustColumn(i, cols[i].adjust, true) || resize;

        if (resize) {
            this._updateColsSizeSettings(true);
            this._resizeColumns();
        }
    },
    _resizeColumns: function () {
        var cols = this._settings.columns;
        var fill = [];
        var summ = 0;

        if (cols && !this._settings.autowidth)
            for (var i = 0; i < cols.length; i++) {
                var colfil = cols[i].fillspace;
                if (colfil) {
                    fill[i] = colfil;
                    summ += colfil * 1 || 1;
                }
            }

        if (summ)
            this._fillColumnSize(fill, summ);
    },
    _fillColumnSize: function (fill, summ) {
        var cols = this._settings.columns;
        if (!cols) return;

        var width = this._content_width - this._scrollSizeY;
        var resize = false;

        if (width > 0) {
            for (var i = 0; i < cols.length; i++)
                if (!fill[i]) width -= (cols[i].width || this.config.columnWidth);

            for (var i = 0; i < fill.length; i++)
                if (fill[i]) {
                    var request = Math.min(width, Math.round(width * fill[i] / summ));
                    resize = this._setColumnWidth(i, request, true) || resize;
                    width = width - cols[i].width;
                    summ = summ - fill[i];
                }

            if (resize)
                this._updateColsSizeSettings(true);
        }
    },
    _getColumnConfigSize: function (ind, headers) {
        var config = this._settings.columns[ind];
        var max = config.minColumnWidth || 10;

        //get max data width
        if (headers != "header") {
            var order = [].concat(this.data.order);
            for (var i = 0; i < order.length; i++)
                order[i] = order[i] ? this._getValue(this.getItem(order[i]), config, 0) : "";
            max = Math.max(max, smdui.html.getTextSize(order, "smdui_table_cell smdui_cell").width);
        }

        //get max header width
        if (headers != "data") {
            for (var i = 0; i < config.header.length; i++) {
                var header = config.header[i];
                if (header) {
                    var width = 0;
                    if (header.rotate)
                        for (var h = 0; h < (header.rowspan || 1); h++)
                            width += this._headers[h];
                    var css = "smdui_table_cell smdui_cell " + (header.css || "") + (header.rotate ? "smdui_measure_rotate" : "");
                    var size = smdui.html.getTextSize([header.text], css, width);
                    max = Math.max(max, header.rotate ? size.height : size.width);
                }
            }
        }

        //1px to compensate offsetWidth rounding
        return max + 1 + (smdui.env.isIE ? smdui.skin.$active.layoutPadding.space : 0);
    },
    _adjustColumn: function (ind, headers, ignore) {
        if (ind >= 0) {
            var width = this._getColumnConfigSize(ind, headers);
            return this._setColumnWidth(ind, width, ignore);
        }
    },
    adjustColumn: function (id, headers) {
        this._adjustColumn(this.getColumnIndex(id), headers);
    },
    adjustRowHeight: function (id, silent) {
        if (id) {
            var config = this.getColumnConfig(id);
            var container;
            var d = smdui.html.create("DIV", { "class": "smdui_table_cell smdui_measure_size smdui_cell" }, "");
            d.style.cssText = "width:" + config.width + "px; height:1px; visibility:hidden; position:absolute; top:0px; left:0px; overflow:hidden;";
            this.$view.appendChild(d);

            if (d.offsetHeight < 1) {
                //hidden container, height detection is broken
                //reattach to the body
                container = this.$view.cloneNode(true);
                document.body.appendChild(container);
                container.appendChild(d);
            }

            this.data.each(function (obj) {
                //in case of dyn. mode - this can be undefined 
                if (obj) {
                    d.innerHTML = this._getValue(obj, config, 0);
                    obj.$height = Math.max(d.scrollHeight, this._settings.rowHeight);
                }
            }, this);

            d = smdui.html.remove(d);
            if (container)
                smdui.html.remove(container);
        } else {
            var heightsArr = new Array(this.data.count()).join('0').split('');
            var cols = this.config.columns;

            for (var i = 0; i < cols.length; i++) {
                this.adjustRowHeight(cols[i].id, true);
                this.data.each(function (obj, index) {
                    if (obj.$height > heightsArr[index]) {
                        heightsArr[index] = obj.$height;
                    }
                    obj.$height = heightsArr[index];
                });
            }
        }

        if (!silent)
            this.refresh();
    }
});

smdui.extend(smdui.ui.datatable, {

    math_setter: function (value) {
        if (value)
            this._math_init();
        return value;
    },

    _math_pref: '$',

    _math_init: function () {
        if (smdui.env.strict) return;

        this.data.attachEvent("onStoreUpdated", smdui.bind(this._parse_row_math, this));
        this.data.attachEvent("onStoreLoad", smdui.bind(this._parse_math, this));
        this.attachEvent("onStructureLoad", this._parse_math);
    },
    _parse_row_math: function (id, obj, action) {
        if (!id || (action == "delete" || action == "paint")) return;

        if (action == "add")
            this._exprs_by_columns(obj);

        for (var i = 0; i < this._columns.length; i++)
            this._parse_cell_math(id, this._columns[i].id, action !== "add");
        this._math_recalc = {};
    },
    _parse_cell_math: function (row, col, _inner_call) {
        var item = this.getItem(row);
        var value;

        // if it's outer call we should use inputted value otherwise to take formula, not calculated value
        if (_inner_call === true)
            value = item[this._math_pref + col] || item[col];
        else {
            value = item[col];
            this._math_recalc = {};
        }

        if (typeof value === "undefined" || value === null) return;

        if (value.length > 0 && value.substr(0, 1) === '=') {
            // calculate math value
            if (!item[this._math_pref + col] || (_inner_call !== true))
                item[this._math_pref + col] = item[col];
            item[col] = this._calculate(value, row, col);
            //this.updateItem(item);
        } else {
            // just a string
            if (typeof (item[this._math_pref + col]) !== 'undefined')
                delete item[this._math_pref + col];
            // remove triggers if they were setted earlier
            this._remove_old_triggers(row, col);
        }
        // recalculate depending cells
        if (typeof (item.depends) !== 'undefined' && typeof (item.depends[col]) !== 'undefined') {
            for (var i in item.depends[col]) {
                var name = item.depends[col][i][0] + '__' + item.depends[col][i][1];
                if (typeof (this._math_recalc[name]) === 'undefined') {
                    this._math_recalc[name] = true;
                    this._parse_cell_math(item.depends[col][i][0], item.depends[col][i][1], true);
                }
            }
        }
    },

    _set_original_value: function (row, col) {
        var item = this.getItem(row);
        if (typeof (item[this._math_pref + col]) !== 'undefined')
            item[col] = item[this._math_pref + col];
    },

    _parse_math: function () {
        if (!this._columns || !this.count()) return;

        this._exprs_by_columns();


        for (var j = 0; j < this._columns.length; j++) {
            var col = this.columnId(j);
            this.data.each(function (obj) {
                this._parse_cell_math(obj.id, col);
            }, this);
        }

        this._math_recalc = {};
    },

    _exprs_by_columns: function (row) {
        for (var i = 0; i < this._columns.length; i++) {
            if (this._columns[i].math) {
                var col = this.columnId(i);
                var math = '=' + this._columns[i].math;
                math = math.replace(/\$r/g, '#$r#');
                math = math.replace(/\$c/g, '#$c#');
                if (row)
                    row[col] = this._parse_relative_expr(math, row.id, col);
                else
                    this.data.each(function (obj) {
                        obj[col] = this._parse_relative_expr(math, obj.id, col);
                    }, this);
            }
        }
    },

    _parse_relative_expr: function (expr, row, col) {
        return (smdui.template(expr))({ '$r': row, '$c': col });
    },

    _get_calc_value: function (row, col) {
        var item;

        if (this.exists(row))
            item = this.getItem(row);
        else
            return '#out_of_range';

        var value = item[this._math_pref + col] || item[col] || 0;
        value = value.toString();
        if (value.substring(0, 1) !== '=')
            // it's a string
            return value;
        else {
            // TODO: check if value shouldn't be recalculated
            // and return value calculated earlier

            // calculate math expr value right now
            if (typeof (item[this._math_pref + col]) === 'undefined')
                item[this._math_pref + col] = item[col];
            item[col] = this._calculate(value, row, col, true);
            return item[col];
        }
    },

    _calculate: function (value, row, col, _inner_call) {
        // add coord in math trace to detect self-references
        if (_inner_call === true) {
            if (this._in_math_trace(row, col))
                return '#selfreference';
        } else
            this._start_math_trace();
        this._to_math_trace(row, col);

        var item = this.getItem(row);
        value = value.substring(1);

        // get operations list
        var operations = this._get_operations(value);
        var triggers = this._get_refs(value);

        if (operations) {
            value = this._replace_refs(value, triggers);
            value = this._parse_args(value, operations);
        } else {
            value = this._replace_refs(value, triggers, true);
        }

        var exc = this._math_exception(value);
        if (exc !== false)
            return exc;

        // remove from coord from trace when calculations were finished - it's important!
        this._from_math_trace(row, col);

        // process triggers to know which cells should be recalculated when one was changed
        this._remove_old_triggers(row, col);
        for (var i = 0; i < triggers.length; i++) {
            this._add_trigger([row, col], triggers[i]);
        }
        var exc = this._math_exception(value);
        if (exc !== false)
            return exc;

        // there aren't any operations here. returns number or value of another cell
        if (!value) return value;

        // process mathematical expression and getting final result
        value = this._compute(value);
        var exc = this._math_exception(value);
        if (exc !== false)
            return exc;
        return value;
    },

    _get_operations: function (value) {
        // gettings operations list (+-*/)
        var splitter = /(\+|\-|\*|\/)/g;
        var operations = value.replace(/\[[^)]*?\]/g, "").match(splitter);
        return operations;
    },

	/*! gets list of referencies in formula
	 **/
    _get_refs: function (value) {
        var reg = /\[([^\]]+),([^\]]+)\]/g;
        var cells = value.match(reg);
        if (cells === null) cells = [];

        for (var i = 0; i < cells.length; i++) {
            var cell = cells[i];
            var tmp = cell;
            cell = cell.substr(1, cell.length - 2);
            cell = cell.split(',');
            cell[0] = this._trim(cell[0]);
            cell[1] = this._trim(cell[1]);
            if (cell[0].substr(0, 1) === ':')
                cell[0] = this.getIdByIndex(cell[0].substr(1));
            if (cell[1].substr(0, 1) === ':')
                cell[1] = this.columnId(cell[1].substr(1));
            cell[2] = tmp;
            cells[i] = cell;
        }

        return cells;
    },

    // replace given list of references by their values
    _replace_refs: function (value, cells, clean) {
        var dell = "(", delr = ")";
        if (clean) dell = delr = "";
        for (var i = 0; i < cells.length; i++) {
            var cell = cells[i];
            var cell_value = this._get_calc_value(cell[0], cell[1]);
            if (isNaN(cell_value))
                cell_value = '"' + cell_value + '"';
            value = value.replace(cell[2], dell + cell_value + delr);
        }
        return value;
    },

    _parse_args: function (value, operations) {
        var args = [];
        for (var i = 0; i < operations.length; i++) {
            var op = operations[i];
            var temp = this._split_by(value, op);
            args.push(temp[0]);
            value = temp[1];
        }
        args.push(value);

        //var reg = /^(-?\d|\.|\(|\))+$/;
        for (var i = 0; i < args.length; i++) {
            var arg = this._trim(args[i]);
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
    },

    _compute: function (expr) {
        try {
            smdui.temp_value = '';
            expr = 'smdui.temp_value = ' + expr;
            eval(expr);
        } catch (ex) {
            smdui.assert(false, "Math error in datatable<br>" + expr);
            smdui.temp_value = '';
        }
        var result = smdui.temp_value;
        smdui.temp_value = null;
        return result.toString();
    },

    _split_by: function (value, splitter) {
        var pos = value.indexOf(splitter);
        var before = value.substr(0, pos);
        var after = value.substr(pos + 1);
        return [before, after];
    },

    _trim: function (value) {
        value = value.replace(/^ */g, '');
        value = value.replace(/ *$/g, '');
        return value;
    },

    _start_math_trace: function () {
        this._math_trace = [];
    },
    _to_math_trace: function (row, col) {
        this._math_trace[row + '__' + col] = true;
    },
    _from_math_trace: function (row, col) {
        if (typeof (this._math_trace[row + '__' + col]) !== 'undefined')
            delete this._math_trace[row + '__' + col];
    },
    _in_math_trace: function (row, col) {
        if (typeof (this._math_trace[row + '__' + col]) !== 'undefined')
            return true;
        else
            return false;
    },

    _add_trigger: function (depends, from) {
        var item = this.getItem(from[0]);
        if (typeof (item.depends) === 'undefined')
            item.depends = {};
        if (typeof (item.depends[from[1]]) === 'undefined')
            item.depends[from[1]] = {};
        item.depends[from[1]][depends[0] + '__' + depends[1]] = depends;

        item = this.getItem(depends[0]);
        if (typeof (item.triggers) === 'undefined')
            item.triggers = {};
        if (typeof (item.triggers[depends[1]]) === 'undefined')
            item.triggers[depends[1]] = {};
        item.triggers[depends[1]][from[0] + '__' + from[1]] = from;
    },

    _remove_old_triggers: function (row, col) {
        if (!this.exists(row, col)) return;
        var item = this.getItem(row, col);
        if (typeof (item.triggers) === 'undefined') return;
        for (var i in item.triggers[col]) {
            var depend = item.triggers[col][i];
            delete this.getItem(depend[0]).depends[depend[1]][row + '__' + col];
        }
    },

    // check if exception syntax exists and returns exception text or false
    _math_exception: function (value) {
        var reg = /#\w+/;
        var match = value.match(reg);
        if (match !== null && match.length > 0)
            return match[0];
        return false;
    }

});

smdui.extend(smdui.ui.datatable, {

    /////////////////////////
    //    edit start       //
    /////////////////////////
    _get_editor_type: function (id) {
        return this.getColumnConfig(id.column).editor;
    },
    getEditor: function (row, column) {
        if (!row)
            return this._last_editor;

        if (arguments.length == 1) {
            column = row.column;
            row = row.row;
        }

        return ((this._editors[row] || {})[column]);
    },
    _for_each_editor: function (handler) {
        for (var row in this._editors) {
            var row_editors = this._editors[row];
            for (var column in row_editors)
                if (column != "$count")
                    handler.call(this, row_editors[column]);
        }
    },
    _init_editor: function (id, type, show) {
        var row = id.row;
        var column = id.column;
        var col_settings = type.config = this.getColumnConfig(column);
        //show it over cell
        if (show !== false)
            this.showCell(row, column);

        var node = type.render();

        if (type.$inline)
            node = this._locateInput(id);
        type.node = node;

        var item = this.getItem(row);
        var format = col_settings.editFormat;

        var value;
        if (this._settings.editMath)
            value = item["$" + column];
        value = value || item[column];

        if (smdui.isUndefined(value))
            value = "";

        type.setValue(format ? format(value) : value, item);
        type.value = item[column];
        this._addEditor(id, type);

        if (!type.$inline)
            this._sizeToCell(id, node, true);

        if (type.afterRender)
            type.afterRender();

        if (this._settings.liveValidation) {
            smdui._event(type.node, "keyup", this._bind_live_validation(id, this));
            this.validateEditor(id);
        }

        return node;
    },
    _bind_live_validation: function (id, that) {
        return function () {
            that.validateEditor(id);
        };
    },
    _set_new_value: function (editor, new_value, copy) {
        var parser = this.getColumnConfig(editor.column).editParse;
        var item = copy ? {} : this.getItem(editor.row);
        item[editor.column] = parser ? parser(new_value) : new_value;

        if (this._settings.editMath)
            item["$" + editor.column] = null;

        return item;
    },
    //register editor in collection
    _addEditor: function (id, type, node) {
        var row_editors = this._editors[id.row] = this._editors[id.row] || {};

        row_editors.$count = (row_editors.$count || 0) + 1;

        type.row = id.row; type.column = id.column;
        this._last_editor = row_editors[id.column] = type;

        this._in_edit_mode++;
        this._last_editor_scroll = this.getScrollState();
    },
    _removeEditor: function (editor) {
        if (this._last_editor == editor)
            this._last_editor = 0;

        if (editor.destroy)
            editor.destroy();

        var row = this._editors[editor.row];
        delete row[editor.column];
        row.$count--;
        if (!row.$count)
            delete this._editors[editor.row];
        this._in_edit_mode--;
    },
    _changeEditorId: function (oldid, newid) {
        var editor = this._editors[oldid];
        if (editor) {
            this._editors[newid] = editor;
            delete this._editors[oldid];
            for (var key in editor)
                editor[key].row = newid;
        }
    },
    //get html cell by combined id
    _locate_cell: function (id) {
        var area, i, index, j, node, span,
            config = this.getColumnConfig(id.column),
            cell = 0;

        if (config && config.node && config.attached) {
            index = this.getIndexById(id.row);
            if (this._spans_pull) {
                span = this.getSpan(id.row, id.column);
                if (span) {
                    for (i = 0; i < 3; i++) {
                        area = this._spans_areas[i];
                        for (j = 0; !cell && j < area.childNodes.length; j++) {
                            node = area.childNodes[j];
                            if (node.getAttribute("row") == index && node.getAttribute("column") == this.getColumnIndex(id.column))
                                cell = node;
                        }
                    }
                }
            }

            if (!cell && index >= (config._yr0 - this._settings.topSplit) && index < config._yr1)
                cell = config.node.childNodes[index - config._yr0 + this._settings.topSplit];
        }
        return cell;
    },


    /////////////////////////
    //    public methods   //
    /////////////////////////
    editCell: function (row, column, preserve, show) {
        column = column || this._settings.columns[0].id;
        return smdui.EditAbility.edit.call(this, { row: row, column: column }, preserve, show);
    },
    editRow: function (id, focus) {
        if (id && id.row)
            id = id.row;

        var next = false;
        this.eachColumn(function (column) {
            this.edit({ row: id, column: column }, next, !next);
            next = true;
        });
    },
    editColumn: function (id, focus) {
        if (id && id.column)
            id = id.column;

        var next = false;
        this.eachRow(function (row) {
            this.edit({ row: row, column: id }, next, !next);
            next = true;
        });
    },
    eachRow: function (handler, all) {
        var order = this.data.order;
        if (all)
            order = this.data._filter_order || order;

        for (var i = 0; i < order.length; i++)
            handler.call(this, order[i]);
    },
    eachColumn: function (handler, all) {
        for (var i in this._columns_pull) {
            var column = this._columns_pull[i];
            handler.call(this, column.id, column);
        }
        if (all) {
            for (var i in this._hidden_column_hash) {
                var column = this._hidden_column_hash[i];
                handler.call(this, column.id, column);
            }
        }
    },


    ////////////////////
    //    edit next   //
    ////////////////////
    _after_edit_next: function (editor_next) {
        if (this.getSelectedId) {	//select related cell when possible
            var sel = this.getSelectedId(true);
            if (sel.length == 1) {
                this._select(editor_next);
                return false;
            }
        }
    },
    _custom_tab_handler: function (tab, e) {
        if (this._settings.editable && !this._in_edit_mode) {
            //if we have focus in some custom input inside of datatable
            if (e.target && e.target.tagName == "INPUT") return true;

            var selection = this.getSelectedId(true);
            if (selection.length == 1) {
                this.editNext(tab, selection[0]);
                return false;
            }
        }
        return true;
    },

    _find_cell_next: function (start, check, direction) {
        var row = this.getIndexById(start.row);
        var column = this.getColumnIndex(start.column);
        var order = this.data.order;
        var cols = this._columns;

        if (direction) {

            for (var i = row; i < order.length; i++) {
                for (var j = column + 1; j < cols.length; j++) {
                    var id = { row: order[i], column: cols[j].id };
                    if (check.call(this, id) && (!this._checkCellMerge || !this._checkCellMerge(start, id))) {
                        return id;
                    }
                }
                column = -1;
            }
        } else {
            for (var i = row; i >= 0; i--) {
                for (var j = column - 1; j >= 0; j--) {
                    var id = { row: order[i], column: cols[j].id };
                    if (check.call(this, id))
                        return id;
                }
                column = cols.length;
            }
        }

        return null;
    },


    /////////////////////////////
    //    scroll correction    //
    /////////////////////////////
    _correct_after_focus_y: function () {
        if (this._in_edit_mode) {
            if (this._ignore_after_focus_scroll)
                this._ignore_after_focus_scroll = false;
            else {
                this._y_scroll.scrollTo(this.getScrollState().y + this._body.childNodes[1].firstChild.scrollTop);
                this._body.childNodes[1].firstChild.scrollTop = 0;
                this._ignore_after_focus_scroll = true;
            }
        }
    },
    _correct_after_focus_x: function () {
        if (this._in_edit_mode) {
            this._x_scroll.scrollTo(this._body.childNodes[1].scrollLeft);
        }
    },
    _component_specific_edit_init: function () {
        this.attachEvent("onScrollY", this._update_editor_y_pos);
        this.attachEvent("onScrollX", this._update_editor_y_pos);
        this.attachEvent("onScrollY", this._refocus_inline_editor);
        this.attachEvent("onColumnResize", function () { this.editStop(); });
        this.attachEvent("onAfterFilter", function () { this.editStop(); });
        this.attachEvent("onRowResize", function () { this.editStop(); });
        this.attachEvent("onAfterScroll", function () { if (this._settings.topSplit) this.editStop(); });
        this._body.childNodes[1].firstChild.onscroll = smdui.bind(this._correct_after_focus_y, this);
        this._body.childNodes[1].onscroll = smdui.bind(this._correct_after_focus_x, this);
    },
    _update_editor_y_pos: function () {
        if (this._in_edit_mode) {
            var old = this._last_editor_scroll;
            this._last_editor_scroll = this.getScrollState();

            var diff = this._last_editor_scroll.y - old.y;
            this._for_each_editor(function (editor) {
                if (editor.getPopup) {
                    var node = this.getItemNode(editor);
                    if (node)
                        editor.getPopup().show(node);
                    else
                        editor.getPopup().show({ x: -10000, y: -10000 });
                } else if (!editor.$inline) {
                    editor.node.top -= diff;
                    editor.node.style.top = editor.node.top + "px";
                }
            });
        }
    }

});

smdui.extend(smdui.ui.datatable, smdui.EditAbility);
smdui.extend(smdui.ui.datatable, {
    $init: function () {
        this._clear_hidden_state();
        this.attachEvent("onStructureLoad", this._hideInitialColumns);
    },
    _clear_hidden_state: function () {
        this._hidden_column_hash = {};
        this._hidden_column_order = smdui.toArray();
        this._hidden_split = [0, 0];
    },
    _hideInitialColumns: function () {
        var cols = this._columns;

        for (var i = 0; i < cols.length; i++) {
            if (cols[i].header) this._getInitialSpans(cols, cols[i].header);
            if (cols[i].footer) this._getInitialSpans(cols, cols[i].footer);
        }

        for (var i = cols.length - 1; i >= 0; i--) {
            if (cols[i].hidden)
                this.hideColumn(cols[i].id, true, true);
            else if (cols[i].batch && this.config.visibleBatch && cols[i].batch != this.config.visibleBatch) {
                this.hideColumn(cols[i].id, true, true);
            }
        }
    },
    _getInitialSpans: function (cols, elements) {
        for (var h = 0; h < elements.length; h++) {
            var line = elements[h];
            if (line && line.colspan)
                line.$colspan = line.colspan;
        }
    },
    moveColumn: function (id, index) {
        var start_index = this.getColumnIndex(id);
        if (start_index == index) return; //already in place
        var columns = this._settings.columns;

        var start = columns.splice(start_index, 1);
        var pos = index - (index > start_index ? 1 : 0);
        smdui.PowerArray.insertAt.call(columns, start[0], pos);

        //TODO: split handling
        //we can move split line when column dropped after it

        this._refresh_columns();
    },
    _init_horder: function () {
        var horder = this._hidden_column_order;
        var cols = this._settings.columns;
        if (!horder.length) {
            for (var i = 0; i < cols.length; i++)
                horder[i] = cols[i].id;
            this._hidden_split = [this._settings.leftSplit, this._rightSplit];
        }
    },
    isColumnVisible: function (id) {
        return !this._hidden_column_hash[id];
    },
    hideColumn: function (id, mode, silent) {
        var cols = this._settings.columns;
        var horder = this._hidden_column_order;
        var hhash = this._hidden_column_hash;
        var column;
        var span = 1;

        if (mode !== false) {

            var index = this.getColumnIndex(id);
            smdui.assert(index != -1, "hideColumn: invalid ID or already hidden");
            if (index === -1 || !this.callEvent("onBeforeColumnHide", [id])) return;

            //in case of second call to hide the same column, command will be ignored
            if (index == -1) return;

            this._init_horder();
            var header = cols[index].header[0];
            if (header)
                header.$groupSpan = span = (header.colspan || 1);

            if (index < this._settings.leftSplit)
                this._settings.leftSplit -= span;
            if (index >= this._rightSplit)
                this._settings.rightSplit -= span;
            else
                this._rightSplit -= span;
            for (var i = index + span - 1; i >= index; i--) {
                this._hideColumn(index);
                column = cols.splice(index, 1)[0];
                hhash[column.id] = column;
                column._yr0 = -1;
                delete this._columns_pull[column.id];
            }

            this.callEvent("onAfterColumnHide", [id]);
        } else {
            column = hhash[id];
            smdui.assert(column, "showColumn: invalid ID or already visible");

            //in case of second show command for already visible column - ignoring
            if (!column || !this.callEvent("onBeforeColumnShow", [id])) return;

            var prev = null;
            var i = 0;
            var hindex = 0;
            for (; i < horder.length; i++) {
                if (horder[i] == id) {
                    hindex = i;
                    break;
                }
                if (!hhash[horder[i]])
                    prev = horder[i];
            }

            var index = prev ? this.getColumnIndex(prev) + 1 : 0;
            var header = column.header[0];
            if (header) {
                header.colspan = header.$groupSpan || header.colspan;
                delete header.$groupSpan;
                span = (header.colspan || 1);
            }


            if (i < this._hidden_split[0])
                this._settings.leftSplit += span;
            if (i >= this._hidden_split[1])
                this._settings.rightSplit += span;
            else
                this._rightSplit += span;

            for (var i = hindex + span - 1; i >= hindex; i--) {
                var column = hhash[horder[i]];
                smdui.PowerArray.insertAt.call(cols, column, index);
                delete column.hidden;
                delete hhash[column.id];
                this._columns_pull[column.id] = column;
            }

            this.callEvent("onAfterColumnShow", [id]);
        }

        if (column.header) this._fixColspansHidden(column, mode !== false ? 0 : 1, "header");
        if (column.footer) this._fixColspansHidden(column, mode !== false ? 0 : 1, "footer");

        if (!silent)
            this._refresh_columns();
    },
    _fixColspansHidden: function (config, mod, elName) {
        for (var i = config[elName].length - 1; i >= 0; i--) {
            var ind = this._hidden_column_order;
            var spanSource, isHidden = false, spanSize = 0;

            for (var j = 0; j < ind.length; j++) {
                var config = this.getColumnConfig(ind[j]);
                var el = config[elName][i];
                if (!this.isColumnVisible(ind[j])) {
                    //hidden column
                    if (el && el.$colspan && spanSize <= 0) {
                        //start of colspan in hidden
                        spanSize = el.colspan = el.$colspan;
                        isHidden = spanSource = el;
                    }
                    if (spanSource && spanSize > 0) {
                        //hidden column in colspan, decrease colspan size
                        spanSource.colspan--;
                    }
                } else {
                    //visible column
                    if (isHidden && spanSize > 0 && spanSource && spanSource.colspan > 0) {
                        //bit start of colspan is hidden
                        el = config[elName][i] = spanSource;
                        spanSource = el;
                    } else if (el && el.$colspan && spanSize <= 0) {
                        //visible start of colspan
                        spanSize = el.colspan = el.$colspan;
                        spanSource = el;
                    }
                    isHidden = null;
                }
                spanSize--;
            }
        }
    },
    refreshColumns: function (columns, reset) {
        if ((columns && columns != this.config.columns) || reset) {
            this._clear_hidden_state();
            this._filter_elements = {};
            if (columns)
                this._rightSplit = columns.length - (this.config.rightSplit || 0);
        }

        this._columns_pull = {};
        //clear rendered data
        for (var i = 0; i < this._columns.length; i++) {
            var col = this._columns[i];
            this._columns_pull[col.id] = col;
            col.attached = col.node = null;
        }
        for (var i = 0; i < 3; i++) {
            this._header.childNodes[i].innerHTML = "";
            this._body.childNodes[i].firstChild.innerHTML = "";
        }

        //render new structure
        this._columns = this.config.columns = (columns || this.config.columns);
        this._rightSplit = this._columns.length - this._settings.rightSplit;

        this._dtable_fully_ready = 0;
        this._define_structure();

        this.callEvent("onStructureUpdate");

        this._update_scroll();
        this.render();
    },
    _refresh_columns: function () {
        this._dtable_fully_ready = 0;
        this.callEvent("onStructureUpdate");

        this._apply_headers();
        this.render();
    },
    showColumn: function (id) {
        return this.hideColumn(id, false);
    },
    showColumnBatch: function (batch, mode) {
        var preserve = typeof mode != "undefined";
        mode = mode !== false;

        this.eachColumn(function (id, col) {
            if (col.batch) {
                var hidden = this._hidden_column_hash[col.id];
                if (!mode) hidden = !hidden;

                if (col.batch == batch && hidden)
                    this.hideColumn(col.id, !mode, true);
                else if (!preserve && col.batch != batch && !hidden)
                    this.hideColumn(col.id, mode, true);
            }
        }, true);

        this._refresh_columns();
    }
});

smdui.extend(smdui.ui.datatable, {
    $init: function () {
        this.attachEvent("onAfterScroll", this._set_focusable_item);
    },
    _set_focusable_item: function () {
        var sel = this._getVisibleSelection();
        if (!sel) {
            var node = this._dataobj.querySelector(".smdui_cell");
            if (node) node.setAttribute("tabindex", "0");
        }
    },
    _getVisibleSelection: function () {
        var sel = this.getSelectedId(true);
        for (var i = 0; i < sel.length; i++) {
            if (this.isColumnVisible(sel[i].column))
                return this.getItemNode(sel[i]);
        }
        return null;
    },
    moveSelection: function (mode, shift) {
        if (this._settings.disabled) return;

        //get existing selection as array
        var t = this.getSelectedId(true);
        var index = t.length - 1;
        var preserve = this._settings.multiselect || this._settings.areaselect ? shift : false;

        //change defaults in case of multiselection
        if (t.length > 1 && this._settings.select !== "cell") {
            t = t.sort(smdui.bind(function (a, b) {
                if (this.getIndexById(a.row) > this.getIndexById(b.row) || this.getColumnIndex(a.column) > this.getColumnIndex(b.column)) return 1;
                else return -1;
            }, this));
            if (mode == "up" || mode == "left" || mode == "top" || mode == "pgup")
                index = 0;

        }

        if (index < 0 && this.count()) { //no selection
            if (mode == "down" || mode == "right") mode = "top";
            else if (mode == "up" || mode == "left") mode = "bottom";
            else return;
            index = 0;
            t = [{ row: 1, column: 1 }];
        }



        if (index >= 0) {
            var row = t[index].row;
            var column = t[index].column;

            if (mode == "top" || mode == "bottom") {
                if (row) {
                    // first/last row setting
                    if (mode == "top")
                        row = this.data.getFirstId();
                    else if (mode == "bottom")
                        row = this.data.getLastId();
                }
                if (column) {
                    // first/last column setting
                    index = 0;
                    if (mode == "bottom")
                        index = this.config.columns.length - 1;
                    column = this.columnId(index);
                }
            } else if (mode == "up" || mode == "down" || mode == "pgup" || mode == "pgdown") {
                if (row) {
                    //it seems row's can be seleted
                    var index = this.getIndexById(row);
                    var step = (mode == "pgup" || mode == "pgdown") ? Math.round(this._dtable_offset_height / this._settings.rowHeight) : 1;
                    //get new selection row
                    if (mode == "up" || mode == "pgup") index -= step;
                    else if (mode == "down" || mode == "pgdown") index += step;
                    //check that we in valid row range
                    if (index < 0) index = 0;
                    if (index >= this.data.order.length) index = this.data.order.length - 1;

                    row = this.getIdByIndex(index);
                    if (!row && this._settings.pager)
                        this.showItemByIndex(index);
                }
            } else if (mode == "right" || mode == "left") {
                if (column && this.config.select != "row") {
                    //it seems column's can be selected
                    var index = this.getColumnIndex(column);
                    //get new selected column
                    if (mode == "right") index++;
                    else if (mode == "left") index--;
                    //check that result column index is in valid range
                    if (index < 0) index = 0;
                    if (index >= this.config.columns.length) index = this.config.columns.length - 1;

                    column = this.columnId(index);
                } else if ((this.open || this._subViewStorage) && mode == "right") {
                    return this.open ? this.open(row) : this.openSub(row);
                } else if ((this.close || this._subViewStorage) && mode == "left") {
                    return this.close ? this.close(row) : this.closeSub(row);
                }
            } else {
                smdui.assert(false, "Not supported selection moving mode");
                return;
            }

            if (row) {
                this.showCell(row, column);

                if (!this.select) { //switch on cell or row selection by default
                    smdui.extend(this, this._selections._commonselect, true);
                    this._settings.select = (this.open || this._subViewStorage ? "row" : "cell");
                    smdui.extend(this, this._selections[this._settings.select], true);
                }

                var cell = { row: row, column: column };

                if (preserve && this._settings.select == "area") {
                    var last = this._selected_areas[this._selected_areas.length - 1];
                    this._extendAreaRange(cell, last, mode);
                }
                else
                    this._select(cell, preserve);

                if (!this._settings.clipboard) {
                    var node = this.getItemNode(cell);
                    if (node) node.focus();
                }

            }
        }

        return false;
    }
});
smdui.extend(smdui.ui.datatable, smdui.KeysNavigation);

smdui.extend(smdui.ui.datatable, smdui.DataMove);
smdui.extend(smdui.ui.datatable, {
    drag_setter: function (value) {
        // disable drag-n-drop for frozen rows
        this.attachEvent("onBeforeDrag", function (context) {
            return this._checkDragTopSplit(context.source);
        });
        this.attachEvent("onBeforeDragIn", function (context) {
            return this._checkDragTopSplit(context.target);
        });
        this.attachEvent("onBeforeDropOrder", function (startId, index) {
            return index < 0 || index >= this._settings.topSplit;
        });

        return smdui.DragItem.drag_setter.call(this, value);
    },
    _checkDragTopSplit: function (ids) {
        var i, index,
            frozen = false;
        if (this._settings.topSplit && ids) {
            if (!smdui.isArray(ids))
                ids = [ids];
            for (i = 0; !frozen && i < ids.length; i++) {
                index = this.getIndexById(ids[i]);
                frozen = index < this._settings.topSplit;
            }
        }
        return !frozen;
    },
    $dragHTML: function (item, e) {
        var width = this._content_width - this._scrollSizeY;
        var html = "<div class='smdui_dd_drag' style='width:" + (width - 2) + "px;'>";
        var cols = this._settings.columns;
        for (var i = 0; i < cols.length; i++) {
            var value = this._getValue(item, cols[i]);
            html += "<div style='width:" + cols[i].width + "px;'>" + value + "</div>";
        }
        return html + "</div>";
    },
    getHeaderNode: function (column_id, row_index) {
        if (this.isColumnVisible(column_id)) {

            var ind = this.getColumnIndex(column_id);
            var hind = this._settings.leftSplit > ind ? 0 : (this._rightSplit <= ind ? 2 : 1);
            row_index = row_index || 0;

            var nodes = this._header.childNodes[hind].getElementsByTagName("TR")[row_index + 1].childNodes;
            for (var i = 0; i < nodes.length; i++)
                if (nodes[i].getAttribute("column") == ind)
                    return nodes[i].firstChild;

        }
        return null;
    },
    getItemNode: function (id, e) {
        if (id && !id.header) {
            var row = id.row || id;
            var rowindex = this.getIndexById(row);
            var state = this._get_y_range();
            var minRow = state[0] - this._settings.topSplit;
            //row not visible
            if (rowindex < minRow && rowindex > state[1]) return;

            //get visible column
            var x_range = this._get_x_range();
            var colindex = this._settings.leftSplit ? 0 : x_range[0];
            if (id.column) {
                colindex = this.getColumnIndex(id.column);
                //column not visible
                if (colindex < this._rightSplit && colindex >= this._settings.leftSplit && (colindex < x_range[0] || colindex > x_range[1]))
                    return;
            }

            var column = this._settings.columns[colindex];

            if (column.attached && column.node) {
                var nodeIndex = rowindex < this._settings.topSplit ? rowindex : (rowindex - minRow);
                return column.node.childNodes[nodeIndex];
            }

        }
    },
    dragColumn_setter: function (value) {
        var control; //will be defined below
        if (value == "order") {
            control = {
                $drag: smdui.bind(function (s, e) {
                    var id = this.locate(e);
                    if (this._rs_process || !id || !this.callEvent("onBeforeColumnDrag", [id.column, e])) return false;
                    smdui.DragControl._drag_context = { from: control, start: id, custom: "column_dnd" };

                    var column = this.getColumnConfig(id.column);

                    this._relative_column_drag = smdui.html.posRelative(e);
                    this._limit_column_drag = column.width;

                    return "<div class='smdui_dd_drag_column' style='width:" + column.width + "px'>" + (column.header[0].text || "&nbsp;") + "</div>";
                }, this),
                $dragPos: smdui.bind(function (pos, e, node) {
                    var context = smdui.DragControl.getContext();
                    var box = smdui.html.offset(this.$view);
                    node.style.display = 'none';
                    var html = document.elementFromPoint(pos.x, box.y + 1);

                    var id = (html ? this.locate(html) : null);

                    var start = smdui.DragControl.getContext().start.column;

                    if (id && id.column != start && (!this._column_dnd_temp_block || id.column != this._last_sort_dnd_node)) {
                        //ignore normal dnd , and dnd from other components
                        if (context.custom == "column_dnd" && smdui.$$(html) == this) {

                            if (!this.callEvent("onBeforeColumnDropOrder", [start, id.column, e])) return;

                            var start_index = this.getColumnIndex(start);
                            var end_index = this.getColumnIndex(id.column);

                            //on touch devices we need to preserve drag-start element till the end of dnd
                            if (e.touches) {
                                this._dragTarget = e.target;
                                this._dragTarget.style.display = "none";
                                this.$view.parentNode.appendChild(this._dragTarget);
                            }

                            this.moveColumn(start, end_index + (start_index < end_index ? 1 : 0));
                            this._last_sort_dnd_node = id.column;
                            this._column_dnd_temp_block = true;
                        }
                    } if (id && id.column == start) {
                        //flag prevent flickering just after column move
                        this._column_dnd_temp_block = false;
                    }

                    node.style.display = 'block';

                    pos.x = pos.x - this._relative_column_drag.x;
                    pos.y = box.y;

                    if (pos.x < box.x)
                        pos.x = box.x;
                    else {
                        var max = box.x + this.$view.offsetWidth - this._scrollSizeY - this._limit_column_drag;
                        if (pos.x > max)
                            pos.x = max;
                    }
                    smdui.DragControl._skip = true;

                }, this),
                $dragDestroy: smdui.bind(function (a, node) {
                    smdui.html.remove(node);
                    //clean dnd source element
                    if (this._dragTarget)
                        smdui.html.remove(this._dragTarget);
                    var id = smdui.DragControl.getContext().start;
                    this.callEvent("onAfterColumnDropOrder", [id.column, this._last_sort_dnd_node, a]);
                }, this),
                $drop: function () { }
            };
        } else if (value) {
            control = {
                _inner_drag_only: true,
                $drag: smdui.bind(function (s, e) {
                    var id = this.locate(e);
                    if (this._rs_process || !id || !this.callEvent("onBeforeColumnDrag", [id.column, e])) return false;
                    smdui.DragControl._drag_context = { from: control, start: id, custom: "column_dnd" };

                    var header = this.getColumnConfig(id.column).header;
                    var text = "&nbsp;";
                    for (var i = 0; i < header.length; i++)
                        if (header[i]) {
                            text = header[i].text;
                            break;
                        }

                    return "<div class='smdui_dd_drag_column'>" + text + "</div>";
                }, this),
                $drop: smdui.bind(function (s, t, e) {
                    var target = e;
                    //on touch devices event doesn't point to the actual drop target
                    if (e.touches && this._drag_column_last)
                        target = this._drag_column_last;

                    var id = this.locate(target);

                    if (!id) return false;
                    var start = smdui.DragControl.getContext().start.column;
                    if (start != id.column) {
                        if (!this.callEvent("onBeforeColumnDrop", [start, id.column, e])) return;
                        var start_index = this.getColumnIndex(start);
                        var end_index = this.getColumnIndex(id.column);

                        this.moveColumn(start, end_index + (start_index < end_index ? 1 : 0));
                        this.callEvent("onAfterColumnDrop", [start, id.column, e]);
                    }
                }, this),
                $dragIn: smdui.bind(function (s, t, e) {
                    var context = smdui.DragControl.getContext();
                    //ignore normal dnd , and dnd from other components

                    if (context.custom != "column_dnd" || context.from != control) return false;

                    var target = (e.target || e.srcElement);
                    while ((target.className || "").indexOf("smdui_hcell") == -1) {
                        target = target.parentNode;
                        if (!target) return;
                    }

                    if (target != this._drag_column_last) {	//new target
                        if (this._drag_column_last)
                            smdui.html.removeCss(this._drag_column_last, "smdui_dd_over_column");
                        smdui.html.addCss(target, "smdui_dd_over_column");
                    }

                    return (this._drag_column_last = target);
                }, this),
                $dragDestroy: smdui.bind(function (a, h) {
                    if (this._drag_column_last)
                        smdui.html.removeCss(this._drag_column_last, "smdui_dd_over_column");
                    smdui.html.remove(h);
                }, this)
            };
        }

        if (value) {
            smdui.DragControl.addDrag(this._header, control);
            smdui.DragControl.addDrop(this._header, control, true);
        }
    }
});
smdui.extend(smdui.ui.datatable, smdui.DragItem);
smdui.extend(smdui.ui.datatable, {
    clearValidation: function () {
        for (var i in this.data._marks)
            this._clear_invalid_css(i);
        this.data.clearMark("smdui_invalid", true);
    },
    _mark_invalid: function (id, details) {
        this._clear_invalid_css(id);
        for (var key in details)
            this.addCellCss(id, key, "smdui_invalid_cell");

        this.addCss(id, "smdui_invalid");
    },
    _clear_invalid: function (id) {
        this._clear_invalid_css(id);
        this.removeCss(id, "smdui_invalid");
    },
    _clear_invalid_css: function (id) {
        var item = this.getItem(id);
        var mark = this.data.getMark(id, "$cellCss");
        if (mark) {
            for (var key in mark)
                mark[key] = mark[key].replace("smdui_invalid_cell", "").replace("  ", " ");
        }
    },

    addRowCss: function (id, css, silent) {
        this.addCss(id, css, silent);
    },
    removeRowCss: function (id, css, silent) {
        this.removeCss(id, css, silent);
    },
    addCellCss: function (id, name, css, silent) {
        var mark = this.data.getMark(id, "$cellCss");
        var newmark = mark || {};

        var style = newmark[name] || "";
        newmark[name] = style.replace(css, "").replace("  ", " ") + " " + css;

        if (!mark) this.data.addMark(id, "$cellCss", false, newmark, true);
        if (!silent)
            this.refresh(id);
    },
    removeCellCss: function (id, name, css, silent) {
        var mark = this.data.getMark(id, "$cellCss");
        if (mark) {
            var style = mark[name] || "";
            if (style)
                mark[name] = style.replace(css, "").replace("  ", " ");
            if (!silent)
                this.refresh(id);
        }
    }
});
smdui.extend(smdui.ui.datatable, smdui.ValidateCollection);

(function () {
    function getData(data) {
        var values = [];
        for (var i = data.length - 1; i >= 0; i--) {
            var value = data[i];
            values[i] = (typeof value === "object" ? value.value : value);
        }
        return values;
    }

    var SLines = smdui.Sparklines = function () { };
    SLines.types = {};

    SLines.getTemplate = function (customConfig) {
        var config = customConfig || {};
        if (typeof customConfig == "string")
            config = { type: customConfig };

        smdui.extend(config, { type: "line" });

        var slConstructor = this.types[config.type];
        smdui.assert(slConstructor, "Unknown sparkline type");
        return smdui.bind(this._template, new slConstructor(config));
    };

    SLines._template = function (item, common, data, column) {
        if (column)
            return this.draw(getData(data), column.width, 33);
        else
            return this.draw(item.data || item, common.width, common.height);
    };
})();

// add "sparklines" type
smdui.attachEvent("onDataTable", function (table) {
    table.type.sparklines = smdui.Sparklines.getTemplate();
});

(function () {
    function setOpacity(color, opacity) {
        color = smdui.color.toRgb(color);
        color.push(opacity);
        return "rgba(" + color.join(",") + ")";
    }

    function joinAttributes(attrs) {
        var result = ' ';
        if (attrs)
            for (var a in attrs)
                result += a + '=\"' + attrs[a] + '\" ';
        return result;
    }
    // SVG
    var SVG = {};

    SVG.draw = function (content, width, height, css) {
        var attrs = {
            xmlns: 'http://www.w3.org/2000/svg',
            version: '1.1',
            height: '100%',
            width: '100%',
            viewBox: '0 0 ' + width + ' ' + height,
            "class": css || ""
        };
        return '<svg ' + joinAttributes(attrs) + '>' + content + '</svg>';
    };
    SVG.styleMap = {
        "lineColor": "stroke",
        "color": "fill"
    };
    SVG.group = function (path) {
        return "<g>" + path + "</g>";
    };
    SVG._handlers = {
        // MoveTo: {x:px,y:py}
        "M": function (p) {
            return " M " + p.x + " " + p.y;
        },
        // LineTo: {x:px,y:py}
        "L": function (p) {
            return " L " + p.x + " " + p.y;
        },
        // Curve: 3 points {x:px,y:py}: two control points and an end point
        "C": function (cp0, cp1, p) {
            return " C " + cp0.x + " " + cp0.y + " " + cp1.x + " " + cp1.y + " " + p.x + " " + p.y;
        },
        // Arc: center point {x:px,y:py}, radius, angle0, angle1
        "A": function (p, radius, angle0, angle1) {
            var x = p.x + Math.cos(angle1) * radius;
            var y = p.y + Math.sin(angle1) * radius;
            var bigCircle = angle1 - angle0 >= Math.PI;
            return " A " + radius + " " + radius + " 0 " + (bigCircle ? 1 : 0) + " 1 " + x + " " + y;
        }
    };
    // points is an array of an array with two elements: {string} line type, {array}
    SVG.definePath = function (points, close) {
        var path = "";
        for (var i = 0; i < points.length; i++) {
            smdui.assert(points[i][0] && typeof points[i][0] == "string", "Path type must be a string");
            var type = (points[i][0]).toUpperCase();
            smdui.assert(this._handlers[type], "Incorrect path type");
            path += this._handlers[type].apply(this, points[i].slice(1));

        }
        if (close)
            path += " Z";

        return path;
    };
    SVG._linePoints = function (points) {
        var result = [];
        for (var i = 0; i < points.length; i++) {
            result.push([i ? "L" : "M", points[i]]);
        }
        return result;
    };
    SVG.setOpacity = function (color, opacity) {
        color = smdui.color.toRgb(color);
        color.push(opacity);
        return "rgba(" + color.join(",") + ")";
    };
    SVG._curvePoints = function (points) {
        var result = [];
        for (var i = 0; i < points.length; i++) {
            var p = points[i];
            if (!i) {
                result.push(["M", p[0]]);
            }
            result.push(["C", p[1], p[2], p[3]]);
        }
        return result;
    };
    SVG.getPath = function (path, css, attrs) {
        attrs = joinAttributes(attrs);
        return '<path class="' + css + '" vector-effect="non-scaling-stroke" d="' + path + '" ' + attrs + '/>';
    };
    SVG.getSector = function (p, radius, angle0, angle1, css, attrs) {
        attrs = joinAttributes(attrs);
        var x0 = p.x + Math.cos(angle0) * radius;
        var y0 = p.y + Math.sin(angle0) * radius;
        var lines = [
            ["M", p],
            ["L", { x: x0, y: y0 }],
            ["A", p, radius, angle0, angle1],
            ["L", p]
        ];


        return '<path class="' + css + '" vector-effect="non-scaling-stroke" d="' + SVG.definePath(lines, true) + '" ' + attrs + '/>';
    };
    SVG.getCurve = function (points, css, attrs) {
        attrs = joinAttributes(attrs);
        var path = this.definePath(this._curvePoints(points));
        return '<path fill="none" class="' + css + '" vector-effect="non-scaling-stroke" d="' + path + '" ' + attrs + '/>';
    };
    SVG.getLine = function (p0, p1, css, attrs) {
        return this.getPath(this.definePath(this._linePoints([p0, p1]), true), css, attrs);
    };
    SVG.getCircle = function (p, radius, css, attrs) {
        attrs = joinAttributes(attrs);
        return '<circle class="' + css + '" cx="' + p.x + '" cy="' + p.y + '" r="' + radius + '" ' + attrs + '/>';
    };
    SVG.getRect = function (x, y, width, height, css, attrs) {
        attrs = joinAttributes(attrs);
        return '<rect class="' + css + '" rx="0" ry="0" x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" ' + attrs + '/>';
    };
    smdui._SVG = SVG;
})();
(function () {
    var defaults = {
        paddingX: 3,
        paddingY: 4,
        radius: 1,
        minHeight: 4,
        eventRadius: 8
    };

    function Area(config) {
        this.config = smdui.extend(smdui.copy(defaults), config || {}, true);
    }

    Area.prototype.draw = function (data, width, height) {
        var eventRadius, graph, path, points, styles,
            config = this.config,
            Line = smdui.Sparklines.types.line.prototype,
            renderer = smdui._SVG;

        // draw area
        points = this.getPoints(data, width, height);
        path = renderer.definePath(Line._getLinePoints(points), true);

        if (config.color)
            styles = this._applyColor(renderer, config.color);

        graph = renderer.group(renderer.getPath(path, 'smdui_sparklines_area' + (styles ? ' ' + styles.area : '')));
        // draw line
        points.splice(points.length - 3, 3);
        path = renderer.definePath(Line._getLinePoints(points));
        graph += renderer.group(renderer.getPath(path, 'smdui_sparklines_line' + (styles ? ' ' + styles.line : '')));
        // draw items
        graph += Line._drawItems(renderer, points, config.radius, 'smdui_sparklines_item' + (styles ? ' ' + styles.item : ''));
        // draw event areas
        eventRadius = Math.min(data.length ? (width - 2 * (config.paddingX || 0)) / data.length : 0, config.eventRadius);
        graph += Line._drawEventItems(renderer, points, eventRadius);
        return renderer.draw(graph, width, height, 'smdui_sparklines_area_chart' + (config.css ? ' ' + config.css : ''));
    };
    Area.prototype._applyColor = function (renderer, color) {
        var config = { 'area': {}, 'line': {}, 'item': {} },
            map = renderer.styleMap;
        if (color) {
            config.area[map.color] = renderer.setOpacity(color, 0.2);
            config.line[map.lineColor] = color;
            config.item[map.color] = color;
            for (var name in config)
                config[name] = smdui.html.createCss(config[name]);
        }

        return config;
    };
    Area.prototype.getPoints = function (data, width, height) {
        var Line = smdui.Sparklines.types.line.prototype;
        var points = Line.getPoints.call(this, data, width, height);
        var x = this.config.paddingX || 0;
        var y = this.config.paddingY || 0;
        points.push({ x: width - x, y: height - y }, { x: x, y: height - y }, { x: x, y: points[0].y });
        return points;
    };
    smdui.Sparklines.types["area"] = Area;
})();
(function () {
    var defaults = {
        paddingX: 3,
        paddingY: 4,
        width: 20,
        margin: 4,
        minHeight: 4,
        eventRadius: 8,
        origin: 0,
        itemCss: function (value) { return value < (this.config.origin || 0) ? " smdui_sparklines_bar_negative" : ""; }
    };
    function Bar(config) {
        this.config = smdui.extend(smdui.copy(defaults), config || {}, true);
    }

    Bar.prototype.draw = function (data, width, height) {
        var i, css, p, y, padding,
            config = this.config,
            graph = "", items = [],
            points = this.getPoints(data, width, height),
            renderer = smdui._SVG;

        // draw bars
        for (i = 0; i < points.length; i++) {
            css = (typeof config.itemCss == 'function' ? config.itemCss.call(this, data[i]) : (config.itemCss || ''));
            if (config.negativeColor && data[i] < config.origin)
                css += ' ' + this._applyColor(renderer, config.negativeColor);
            else if (config.color)
                css += ' ' + this._applyColor(renderer, config.color);
            p = points[i];
            items.push(renderer.getRect(p.x, p.y, p.width, p.height, 'smdui_sparklines_bar ' + css));
        }
        graph += renderer.group(items.join(""));
        // origin)
        y = parseInt(this._getOrigin(data, width, height), 10) + 0.5;
        padding = config.paddingX || 0;
        graph += renderer.group(renderer.getLine({ x: padding, y: y }, { x: width - padding, y: y }, 'smdui_sparklines_origin'));

        // event areas
        var evPoints = this._getEventPoints(data, width, height);
        var evItems = [];
        for (i = 0; i < evPoints.length; i++) {
            p = evPoints[i];
            evItems.push(renderer.getRect(p.x, p.y, p.width, p.height, 'smdui_sparklines_event_area ', { "smdui_area": i }));
        }
        graph += renderer.group(evItems.join(""));
        return renderer.draw(graph, width, height, 'smdui_sparklines_bar_chart' + (config.css ? ' ' + config.css : ''));
    };
    Bar.prototype._applyColor = function (renderer, color) {
        var config = {},
            map = renderer.styleMap;
        if (color)
            config[map.color] = color;
        return smdui.html.createCss(config);
    };
    Bar.prototype._getOrigin = function (data, width, height) {
        var config = this.config;
        var y = config.paddingY || 0;
        height = (height || 100) - y * 2;
        var pos = y + height;
        if (config.origin !== false) {
            var minValue = Math.min.apply(null, data);
            var maxValue = Math.max.apply(null, data);
            var origin = config.origin || -0.000001;
            if (origin >= maxValue) {
                pos = y;
            }
            else if (origin > minValue) {
                var unitY = height / (maxValue - minValue);
                pos -= unitY * (origin - minValue);
            }
        }
        return pos;
    };
    Bar.prototype._getEventPoints = function (data, width, height) {
        var result = [];
        var x = this.config.paddingX || 0;
        var y = this.config.paddingY || 0;
        width = (width || 100) - x * 2;
        height = (height || 100) - y * 2;
        if (data.length) {
            var unitX = width / data.length;
            for (var i = 0; i < data.length; i++)
                result.push({ x: Math.ceil(unitX * i) + x, y: y, height: height, width: unitX });
        }
        return result;
    };
    Bar.prototype.getPoints = function (data, width, height) {
        var config = this.config;
        var minValue = Math.min.apply(null, data);
        if (config.origin < minValue)
            minValue = config.origin;

        var maxValue = Math.max.apply(null, data);
        var result = [];
        var x = config.paddingX;
        var y = config.paddingY;
        var margin = config.margin;
        var barWidth = config.width || 20;
        var originY = this._getOrigin(data, width, height);
        width = (width || 100) - x * 2;
        height = (height || 100) - y * 2;
        if (data.length) {
            var unitX = width / data.length;
            var yNum = config.scale || (maxValue - minValue);
            barWidth = Math.min(unitX - margin, barWidth);
            margin = unitX - barWidth;
            var minHeight = 0;
            var origin = minValue;

            if (config.origin !== false && config.origin > minValue)
                origin = config.origin || 0;
            else
                minHeight = config.minHeight;

            var unitY = (height - minHeight) / (yNum ? yNum : 1);

            for (var i = 0; i < data.length; i++) {
                var h = Math.ceil(unitY * (data[i] - origin));
                result.push({ x: Math.ceil(unitX * i) + x + margin / 2, y: originY - (data[i] >= origin ? h : 0) - minHeight, height: Math.abs(h) + minHeight, width: barWidth });
            }

        }
        return result;
    };
    smdui.Sparklines.types["bar"] = Bar;
})();
(function () {
    var defaults = {
        paddingX: 6,
        paddingY: 6,
        radius: 2,
        minHeight: 4,
        eventRadius: 8
    };
    function Line(config) {
        this.config = smdui.extend(smdui.copy(defaults), config || {}, true);
    }

    Line.prototype.draw = function (data, width, height) {
        var points = this.getPoints(data, width, height);
        var config = this.config;
        var renderer = smdui._SVG;
        var styles = config.color ? this._applyColor(renderer, config.color) : null;
        // draw line
        var path = renderer.definePath(this._getLinePoints(points));
        var graph = renderer.group(renderer.getPath(path, 'smdui_sparklines_line' + (styles ? ' ' + styles.line : '')));
        // draw items
        graph += this._drawItems(renderer, points, config.radius, 'smdui_sparklines_item' + (styles ? ' ' + styles.item : ''));
        // draw event items
        var eventRadius = Math.min(data.length ? (width - 2 * (config.paddingX || 0)) / data.length : 0, config.eventRadius);
        graph += this._drawEventItems(renderer, points, eventRadius);
        return renderer.draw(graph, width, height, "smdui_sparklines_line_chart" + (config.css ? ' ' + config.css : ''));
    };
    Line.prototype._applyColor = function (renderer, color) {
        var config = { 'line': {}, 'item': {} },
            map = renderer.styleMap;
        if (color) {
            config.line[map.lineColor] = color;
            config.item[map.color] = color;
            for (var name in config)
                config[name] = smdui.html.createCss(config[name]);
        }
        return config;
    };
    Line.prototype._drawItems = function (renderer, points, radius, css, attrs) {
        var items = [];
        for (var i = 0; i < points.length; i++) {
            items.push(renderer.getCircle(points[i], radius, css, attrs));
        }
        return renderer.group(items.join(""));
    };
    Line.prototype._drawEventItems = function (renderer, points, radius) {
        var items = [];
        for (var i = 0; i < points.length; i++) {
            items.push(renderer.getCircle(points[i], radius, 'smdui_sparklines_event_area', { smdui_area: i }));
        }
        return renderer.group(items.join(""));
    };

    Line.prototype._getLinePoints = function (points) {
        var i, type, result = [];
        for (i = 0; i < points.length; i++) {
            type = i ? "L" : "M";
            result.push([type, points[i]]);
        }
        return result;
    };
    Line.prototype.getPoints = function (data, width, height) {
        var config = this.config;
        var minValue = Math.min.apply(null, data);
        if (typeof config.origin !== "undefined")
            minValue = Math.min(config.origin, minValue);

        var maxValue = Math.max.apply(null, data);
        var result = [];
        var x = config.paddingX || 0;
        var y = config.paddingY || 0;
        width = (width || 100) - x * 2;
        var minHeight = config.minHeight || 0;
        height = (height || 100) - y * 2;
        if (data.length) {
            if (data.length == 1)
                result.push({ x: width / 2 + x, y: height / 2 + x });
            else {
                var unitX = width / (data.length - 1);
                var yNum = config.scale || (maxValue - minValue);
                var unitY = (height - minHeight) / (yNum ? yNum : 1);
                if (!yNum)
                    height /= 2;
                for (var i = 0; i < data.length; i++) {
                    result.push({ x: Math.ceil(unitX * i) + x, y: height - Math.ceil(unitY * (data[i] - minValue)) + y - minHeight });
                }
            }
        }
        return result;
    };
    smdui.Sparklines.types["line"] = Line;
})();
(function () {
    var defaults = {
        paddingY: 2
    };

    function Pie(config) {
        this.config = smdui.extend(defaults, config || {}, true);
    }
    Pie.prototype._defColorsCursor = 0;
    Pie.prototype._defColors = [
        "#f55b50", "#ff6d3f", "#ffa521", "#ffc927", "#ffee54", "#d3e153", "#9acb61", "#63b967",
        "#21a497", "#21c5da", "#3ea4f5", "#5868bf", "#7b53c0", "#a943ba", "#ec3b77", "#9eb0b8"
    ];
    Pie.prototype._getColor = function (i, data) {
        var count = data.length;
        var colorsCount = this._defColors.length;
        if (colorsCount > count) {
            if (i) {
                if (i < colorsCount - count)
                    i = this._defColorsCursor + 2;
                else
                    i = this._defColorsCursor + 1;
            }
            this._defColorsCursor = i;
        }
        else
            i = i % colorsCount;
        return this._defColors[i];
    };
    Pie.prototype.draw = function (data, width, height) {
        var attrs, graph, i, sectors,
            config = this.config,
            color = config.color || this._getColor,
            points = this.getAngles(data),
            renderer = smdui._SVG,
            y = config.paddingY || 0,
            // radius
            r = height / 2 - y,
            // center
            x0 = width / 2, y0 = height / 2;

        // draw sectors
        if (typeof color != "function")
            color = function () { return color; };
        sectors = "";
        for (i = 0; i < points.length; i++) {
            attrs = {};
            attrs[renderer.styleMap['color']] = color.call(this, i, data, this._context);
            sectors += renderer.getSector({ x: x0, y: y0 }, r, points[i][0], points[i][1], 'smdui_sparklines_sector', attrs);
        }
        graph = renderer.group(sectors);

        // draw event areas
        sectors = "";
        for (i = 0; i < points.length; i++) {
            sectors += renderer.getSector({ x: x0, y: y0 }, r, points[i][0], points[i][1], 'smdui_sparklines_event_area', { "smdui_area": i });
        }
        graph += renderer.group(sectors);

        return renderer.draw(graph, width, height, 'smdui_sparklines_pie_chart' + (config.css ? ' ' + config.css : ''));
    };
    Pie.prototype.getAngles = function (data) {
        var a0 = -Math.PI / 2, a1,
            i, result = [];

        var ratios = this._getRatios(data);

        for (i = 0; i < data.length; i++) {
            a1 = -Math.PI / 2 + ratios[i] - 0.0001;
            result.push([a0, a1]);
            a0 = a1;
        }
        return result;
    };
    Pie.prototype._getTotalValue = function (data) {
        var t = 0;
        for (var i = 0; i < data.length; i++)
            t += data[i] * 1;
        return t;
    };
    Pie.prototype._getRatios = function (data) {
        var i, value,
            ratios = [],
            prevSum = 0,
            totalValue = this._getTotalValue(data);
        for (i = 0; i < data.length; i++) {
            value = data[i] * 1;
            ratios[i] = Math.PI * 2 * (totalValue ? ((value + prevSum) / totalValue) : (1 / data.length));
            prevSum += value;
        }
        return ratios;
    };

    smdui.Sparklines.types["pie"] = Pie;
})();
(function () {
    var defaults = {
        paddingX: 3,
        paddingY: 6,
        radius: 2,
        minHeight: 4,
        eventRadius: 8
    };

    function Spline(config) {
        this.config = smdui.extend(smdui.copy(defaults), config || {}, true);
    }

    Spline.prototype.draw = function (data, width, height) {
        var config = this.config,
            graph = "",
            Line = smdui.Sparklines.types.line.prototype,
            points = this.getPoints(data, width, height),
            renderer = smdui._SVG,
            styles = config.color ? this._applyColor(renderer, config.color) : null;

        // draw spline
        graph += renderer.group(renderer.getCurve(points, 'smdui_sparklines_line' + (styles ? ' ' + styles.line : '')));

        var linePoints = Line.getPoints.call(this, data, width, height);
        // draw items
        graph += Line._drawItems(renderer, linePoints, config.radius, 'smdui_sparklines_item' + (styles ? ' ' + styles.item : ''));
        // draw event items
        var eventRadius = Math.min(data.length ? (width - 2 * (config.paddingX || 0)) / data.length : 0, config.eventRadius);
        graph += Line._drawEventItems(renderer, linePoints, eventRadius);
        return renderer.draw(graph, width, height, "smdui_sparklines_line_chart" + (config.css ? ' ' + config.css : ''));
    };
    Spline.prototype._applyColor = function (renderer, color) {
        var config = { 'line': {}, 'item': {} },
            map = renderer.styleMap;
        if (color) {
            config.line[map.lineColor] = color;
            config.item[map.color] = color;
            for (var name in config)
                config[name] = smdui.html.createCss(config[name]);
        }
        return config;
    };
    Spline.prototype.getPoints = function (data, width, height) {
        var i, points, px, py,
            result = [], x = [], y = [],
            Line = smdui.Sparklines.types.line.prototype;

        points = Line.getPoints.call(this, data, width, height);

        for (i = 0; i < points.length; i++) {
            x.push(points[i].x);
            y.push(points[i].y);
        }
        px = this._getControlPoints(x);
        py = this._getControlPoints(y);
        /*updates path settings, the browser will draw the new spline*/
        for (i = 0; i < points.length - 1; i++) {
            result.push([points[i], { x: px[0][i], y: py[0][i] }, { x: px[1][i], y: py[1][i] }, points[i + 1]]);
        }
        return result;

    };
    /* code from https://www.particleincell.com/2012/bezier-splines/ */
    Spline.prototype._getControlPoints = function (points) {
        var a = [], b = [], c = [], r = [], p1 = [], p2 = [],
            i, m, n = points.length - 1;

        a[0] = 0;
        b[0] = 2;
        c[0] = 1;
        r[0] = points[0] + 2 * points[1];

        for (i = 1; i < n - 1; i++) {
            a[i] = 1;
            b[i] = 4;
            c[i] = 1;
            r[i] = 4 * points[i] + 2 * points[i + 1];
        }

        a[n - 1] = 2;
        b[n - 1] = 7;
        c[n - 1] = 0;
        r[n - 1] = 8 * points[n - 1] + points[n];

        for (i = 1; i < n; i++) {
            m = a[i] / b[i - 1];
            b[i] = b[i] - m * c[i - 1];
            r[i] = r[i] - m * r[i - 1];
        }

        p1[n - 1] = r[n - 1] / b[n - 1];
        for (i = n - 2; i >= 0; --i)
            p1[i] = (r[i] - c[i] * p1[i + 1]) / b[i];

        for (i = 0; i < n - 1; i++)
            p2[i] = 2 * points[i + 1] - p1[i + 1];

        p2[n - 1] = 0.5 * (points[n] + p1[n - 1]);

        return [p1, p2];
    };

    smdui.Sparklines.types["spline"] = Spline;

    var defaultsArea = {
        paddingX: 3,
        paddingY: 6,
        radius: 1,
        minHeight: 4,
        eventRadius: 8
    };
    // spline area
    function SplineArea(config) {
        this.config = smdui.extend(smdui.copy(defaultsArea), config || {}, true);
    }
    SplineArea.prototype = smdui.copy(Spline.prototype);
    SplineArea.prototype.draw = function (data, width, height) {
        var config = this.config,
            Line = smdui.Sparklines.types.line.prototype,
            renderer = smdui._SVG,
            styles = config.color ? this._applyColor(renderer, config.color) : null;

        var points = this.getPoints(data, width, height);
        // draw area
        var linePoints = points.splice(points.length - 3, 3);
        var linePath = renderer._linePoints(linePoints);
        linePath[0][0] = "L";
        var areaPoints = renderer._curvePoints(points).concat(linePath);
        var graph = renderer.group(renderer.getPath(renderer.definePath(areaPoints), 'smdui_sparklines_area' + (styles ? ' ' + styles.area : ''), true));
        // draw line
        graph += renderer.group(renderer.getPath(renderer.definePath(renderer._curvePoints(points)), 'smdui_sparklines_line' + (styles ? ' ' + styles.line : '')));

        var itemPoints = Line.getPoints.call(this, data, width, height);
        // draw items
        graph += Line._drawItems(renderer, itemPoints, config.radius, 'smdui_sparklines_item' + (styles ? ' ' + styles.item : ''));
        // draw event items
        var eventRadius = Math.min(data.length ? (width - 2 * (config.paddingX || 0)) / data.length : 0, config.eventRadius);
        graph += Line._drawEventItems(renderer, itemPoints, eventRadius);
        return renderer.draw(graph, width, height, "smdui_sparklines_splinearea_chart" + (config.css ? ' ' + config.css : ''));
    };
    SplineArea.prototype._applyColor = function (renderer, color) {
        var config = { 'area': {}, 'line': {}, 'item': {} },
            map = renderer.styleMap;
        if (color) {
            config.area[map.color] = renderer.setOpacity(color, 0.2);
            config.line[map.lineColor] = color;
            config.item[map.color] = color;
            for (var name in config)
                config[name] = smdui.html.createCss(config[name]);
        }
        return config;
    };
    SplineArea.prototype.getPoints = function (data, width, height) {
        var points = Spline.prototype.getPoints.call(this, data, width, height);
        var x = this.config.paddingX || 0;
        var y = this.config.paddingY || 0;
        points.push({ x: width - x, y: height - y }, { x: x, y: height - y }, { x: x, y: points[0][0].y });
        return points;
    };
    smdui.Sparklines.types["splineArea"] = SplineArea;
})();

smdui.extend(smdui.ui.datatable, {
    _prePrint: function (options, htmlOnly) {
        if (options.scroll && !htmlOnly) return true;

        options.header = smdui.isUndefined(options.header) ? (this.config.header ? true : false) : options.header;
        options.footer = smdui.isUndefined(options.footer) ? (this.config.footer ? true : false) : options.footer;
        options.xCorrection = options.xCorrection || 0; //spreadsheet
    },
    _findIndex: function (arr, func) {
        var result = -1;
        for (var i = 0; result < 0 && i < arr.length; i++) {
            if (func(arr[i]))
                result = i;
        }
        return result;
    },
    _getTableHeader: function (base, columns, group) {

        var spans = {}, start = 0;

        base.forEach(smdui.bind(function (tableArray, tid) {
            var row = tableArray[0], headerArray = [], length = row.length;

            row.forEach(smdui.bind(function (cell, cid) {
                var column = columns[cid + start];

                for (var h = 0; h < column[group].length; h++) {
                    var header = column[group][h];

                    if (!header && !(spans[tid] && spans[tid][h])) continue;

                    header = smdui.copy(header || { text: "" });

                    if (spans[tid] && spans[tid][h] && cid === 0) {
                        header.colspan = spans[tid][h];
                        spans[tid][h] = 0;
                    }

                    if (header.colspan) {
                        var colspan = Math.min(header.colspan, (length - cid));
                        spans[tid + 1] = spans[tid + 1] || {};
                        spans[tid + 1][h] = header.colspan - colspan;
                        header.colspan = colspan;
                    }
                    if (header.rowspan && length === 1) {
                        header.height = (header.height || this.config.headerRowHeight) * header.rowspan;
                        header.rowspan = null;
                    }

                    var hcell = {
                        txt: header.rotate ? this.getHeaderNode(column.id, h).innerHTML :
                            (header.text || (header.contentId ? this.getHeaderContent(header.contentId).getValue() : "")),
                        className: "smdui_hcell " + "smdui_" + group + "_cell " + (header.css || ""),
                        style: {
                            height: (header.height || this.config.headerRowHeight) + "px",
                            width: header.colspan ? "auto" : column.width + "px"
                        },
                        span: (header.colspan || header.rowspan) ? { colspan: header.colspan || 1, rowspan: header.rowspan || 1 } : null
                    };
                    headerArray[h] = headerArray[h] || [];
                    headerArray[h][cid] = hcell;
                }
            }, this));
            if (group == "header")
                base[tid] = headerArray.concat(tableArray);
            else
                base[tid] = tableArray.concat(headerArray);
            start += length;
        }, this));

        return base;
    },
    _getTableArray: function (options, base, start) {

        var columns = this.config.columns;
        var sel = this.getSelectedId(true);
        var maxWidth = this._getPageWidth(options);

        var rightRestriction = 0;
        var bottomRestriction = 0;
        var tableArray = [];
        var newTableStart = 0;

        start = start || (0 + options.xCorrection);
        base = base || [];

        this.eachRow(smdui.bind(function (row) {
            var width = 0;
            var rowItem = this.getItem(row);
            var rowIndex = this.getIndexById(row);

            var colrow = [];
            var datarow = false;

            for (var c = start; c < columns.length; c++) {
                var column = columns[c].id;
                var colIndex = this.getColumnIndex(column) - start;

                if (columns[c]) {
                    width += columns[c].width;

                    if (width > maxWidth && c > start) { // 'c>start' ensures that a single long column will have to fit the page
                        newTableStart = c; break;
                    }

                    if (options.data !== "selection" || (options.data == "selection" && this._findIndex(sel, function (obj) {
                        return obj.column == column && obj.row == row;
                    }) !== -1)) {

                        var span = this.getSpan(row, column);
                        //check span from previous table
                        if (span && this.getColumnIndex(column) === start) {
                            var spanStart = this.getColumnIndex(span[1]);
                            if (spanStart < start) {
                                span[2] = span[2] - (start - spanStart);
                                span[4] = span[4] ? span[4] : (rowItem[span[1]] ? this.getText(row, span[1]) : null);
                                span[1] = column;
                            }
                        }

                        if (!span || (span && span[0] == row && span[1] == column)) {
                            var cellValue = span && span[4] ? span[4] : (this._columns_pull[column] ? this.getText(row, column) : "");
                            var className = this.getCss(row, column) + " " + (columns[c].css || "") + (span ? (" smdui_dtable_span " + (span[5] || "")) : "");

                            var style = {
                                height: span && span[3] > 1 ? "auto" : ((rowItem.$height || this.config.rowHeight) + "px"),
                                width: span && span[2] > 1 ? "auto" : columns[c].width + "px"
                            };

                            colrow.push({
                                txt: cellValue, className: className, style: style,
                                span: (span ? { colspan: span[2], spanStart: this.getColumnIndex(span[1]), rowspan: span[3] } : null)
                            });

                            if (cellValue) {
                                rightRestriction = Math.max(colIndex + 1, rightRestriction);
                                bottomRestriction = Math.max(rowIndex + 1, bottomRestriction);
                            }
                            datarow = datarow || !!cellValue;
                        }
                        else if (span) {
                            colrow.push({ $inspan: true });
                            rightRestriction = Math.max(colIndex + 1, rightRestriction);
                            bottomRestriction = Math.max(rowIndex + 1, bottomRestriction);
                        }
                    }
                }
            }

            if (!options.skiprows || datarow)
                tableArray.push(colrow);
        }, this));

        if (bottomRestriction && rightRestriction) {
            if (options.trim) {
                tableArray.length = bottomRestriction;
                tableArray = tableArray.map(function (item) {
                    for (var i = item.length - 1; i >= 0; i--) {
                        if (item[i].span && item[i].span.colspan) {
                            item[i].span.colspan = Math.min(item[i].span.colspan, item.length - i);
                            break;
                        }
                    }
                    item.length = rightRestriction;
                    return item;
                });
            }
            base.push(tableArray);
        }

        if (newTableStart)
            this._getTableArray(options, base, newTableStart);
        else {
            //keep this order as logic relies on the first data row
            if (options.footer)
                base = this._getTableHeader(base, columns, "footer");
            if (options.header)
                base = this._getTableHeader(base, columns, "header");
        }

        return base;
    },
    _getTableHTML: function (tableData, options) {

        var container = smdui.html.create("div");

        tableData.forEach(smdui.bind(function (table, i) {

            var tableHTML = smdui.html.create("table", {
                "class": "smdui_table_print " + this.$view.className + (options.borderless ? " borderless" : ""),
                "style": "border-collapse:collapse"
            });

            table.forEach(function (row) {
                var tr = smdui.html.create("tr");

                row.forEach(function (cell, i) {
                    if (!cell.$inspan) {
                        var td = smdui.html.create("td");

                        td.innerHTML = cell.txt;
                        td.className = cell.className;

                        for (var key in cell.style)
                            td.style[key] = cell.style[key];

                        if (cell.span) {
                            td.colSpan = cell.span.colspan;
                            td.rowSpan = cell.span.rowspan;
                        }
                        tr.appendChild(td);
                    }

                });
                tableHTML.appendChild(tr);
            });
            container.appendChild(tableHTML);

            if (i + 1 < tableData.length) {
                var br = smdui.html.create("DIV", { "class": "smdui_print_pagebreak" });
                container.appendChild(br);
            }

        }, this));

        return container;
    }
});

smdui.extend(smdui.ui.datatable, smdui.CustomPrint);

smdui.extend(smdui.ui.datatable, {
    topSplit_setter: function (value) {
        if (this.data)
            this.data.$freeze = value;
        return value;
    },
    freezeRow: function (id, mode) {
        var index,
            freezeLine = this._settings.topSplit,
            order = this.data.order,
            filterOrder = this.data._filter_order;

        function moveFrozenRow(index, id, mode, order, skipSplitChange) {
            var i;
            if (mode && index >= freezeLine) {
                if (!skipSplitChange)
                    freezeLine++;
                for (i = index; i >= freezeLine; i--) {
                    order[i] = order[i - 1];
                }
                order[freezeLine - 1] = id;
            }
            if (!mode && index < freezeLine) {
                if (!skipSplitChange)
                    freezeLine--;
                for (i = index; i < freezeLine; i++) {
                    order[i] = order[i + 1];
                }
                order[freezeLine] = id;
            }
        }

        if (id) {
            index = this.getIndexById(id);
            id = id.toString();
            moveFrozenRow(index, id, mode, order);
            if (filterOrder)
                moveFrozenRow(filterOrder.find(id), id, mode, filterOrder, true);
        }
        else if (!mode)
            freezeLine = 0; // unfreeze all rows

        this.define("topSplit", freezeLine);
        this.refresh();
    }
});

smdui.TreeTableClick = {};
smdui.TreeTablePaste = {
    insert: function (data) {
        var parent = this.getSelectedId(true, true);
        for (var i = 0; i < data.length; i++) {
            var item = {};
            for (var j = 0; j < this._settings.columns.length; j++) {
                item[this._settings.columns[j].id] = data[i][j] || "";
            }
            if (!smdui.isUndefined(item.id) && this.exists(item.id))
                item.id = smdui.uid();
            this.add(item, null, parent[0]);
        }
    }
};

smdui.protoUI({
    name: "treetable",
    $init: function () {
        smdui.extend(this.data, smdui.TreeStore, true);
        smdui.extend(this.type, smdui.TreeType);
        smdui.extend(this, smdui.TreeDataMove, true);

        for (var key in smdui.TreeClick)
            if (!this.on_click[key])
                this.on_click[key] = this._unwrap_id(smdui.TreeClick[key]);

        this.type.treetable = smdui.template("{common.space()}{common.icon()} {common.folder()}");
        this.type.treecheckbox = function (obj, common) {
            if (obj.indeterminate && !obj.nocheckbox)
                return "<div class='smdui_tree_checkbox smdui_indeterminate'></div>";
            else
                return smdui.TreeType.checkbox.apply(this, arguments);
        };

        this.data.provideApi(this, true);

        this._viewobj.setAttribute("role", "treegrid");

    },
    $exportView: function (options) {
        smdui.extend(options, { filterHTML: true });
        return this;
    },
    _drag_order_complex: false,
    _unwrap_id: function (original) {
        return function (e, id) {
            id = id.row;
            return original.call(this, e, id);
        };
    },
    getState: function () {
        var state = smdui.DataState.getState.call(this);
        smdui.extend(state, smdui.TreeAPI.getState.call(this));
        return state;
    },
    setState: function (state) {
        if (smdui.TreeAPI.setState.call(this, state)) {
            //run grid-state only when tree component was fully loaded 
            smdui.DataState.setState.call(this, state);
        }
    },
    clipboard_setter: function (value) {
        smdui.extend(this._paste, smdui.TreeTablePaste);
        return smdui.TablePaste.clipboard_setter.call(this, value);
    },
    _run_load_next: function (conf, direction) {
        for (var i = 0; i < conf.start; i++) {
            var id = this.data.order[i];
            if (id && this.getItem(id).$level != 1)
                conf.start--;
        }
        return smdui.ui.datatable.prototype._run_load_next.call(this, conf, direction);
    },
}, smdui.TreeAPI, smdui.TreeStateCheckbox, smdui.TreeDataLoader, smdui.ui.datatable);
smdui.extend(smdui.ui.datatable, {
    spans_setter: function (value) {
        if (value && !this._spans_pull)
            this._init_spans_once();

        return value;
    },
    _init_spans_once: function () {
        this._spans_pull = {};
        this._spans_areas = [];

        this.data.attachEvent("onStoreLoad", smdui.bind(function (driver, data) {
            if (data && data.spans)
                this.addSpan(data.spans);
        }, this));
        this.data.attachEvent("onClearAll", smdui.bind(function () {
            this._spans_pull = {};
        }, this));

        this.attachEvent("onScrollY", this._adjust_spans_xy);
        this.attachEvent("onScrollX", this._adjust_spans_xy);
        this.data.attachEvent("onStoreUpdated", smdui.bind(function (id, obj, mode) {
            if (mode != "paint" && this._columns.length)
                this._paint_spans();
        }, this));
        this.attachEvent("onStructureLoad", this._paint_spans);
        this.attachEvent("onStructureUpdate", this._paint_spans);

        this.attachEvent("onColumnResize", this._paint_spans);
        this.attachEvent("onRowResize", this._paint_spans);
        this.attachEvent("onSelectChange", this._paint_spans_selection);
    },
    addSpan: function (id, index, width, height, value, css) {
        //accept an array of objects
        if (typeof id == "object") {
            for (var i = 0; i < id.length; i++)
                this.addSpan.apply(this, id[i]);
            return;
        }

        height = height || 1;
        width = width || 1;

        if (!this._spans_pull[id])
            this._spans_pull[id] = {};

        this._spans_pull[id][index] = [width, height, value, css];
    },

    removeSpan: function (id, index) {
        if (!arguments.length)
            this._spans_pull = {};

        var line = this._spans_pull[id];
        if (line)
            delete line[index];
    },
    getSpan: function (row, column) {
        if (!row) return this._spans_pull;

        var i, iSpan, j, jSpan, span,
            column, row,
            spans = this._spans_pull;

        i = this.getIndexById(row);
        j = this.getColumnIndex(column);

        for (row in spans) {
            for (column in spans[row]) {
                span = spans[row][column];
                iSpan = this.getIndexById(row);
                jSpan = this.getColumnIndex(column);
                if (!(i > iSpan + span[1] - 1 || i < iSpan || j > jSpan + span[0] - 1 || j < jSpan)) {
                    return [row, column].concat(span);
                }
            }
        }

        return null;
    },
    _paint_spans: function () {
        smdui.html.remove(this._spans_areas);
        for (var i = 0; i < 3; i++) {
            var area = this._spans_areas[i] = smdui.html.create("DIV", { "class": "smdui_span_layer" });
            this._body.childNodes[i].appendChild(area);
        }
        // touch scroll
        this.attachEvent("onSyncScroll", function (x, y, t) {
            for (var i = 0; i < 3; i++) {
                smdui.Touch._set_matrix(this._spans_areas[i], (i == 1 ? x : 0), y, t);
            }
        });

        this._adjust_spans_xy();

        if (this._settings.leftSplit)
            this._paint_spans_area(this._spans_areas[0], 0, this._settings.leftSplit);
        if (this._settings.rightSplit)
            this._paint_spans_area(this._spans_areas[2], this._rightSplit, this._columns.length);

        this._paint_spans_area(this._spans_areas[1], this._settings.leftSplit, (this._rightSplit || this._columns.length));
    },

    _paint_spans_area: function (area, start, end) {
        var top = 0;
        var count = this.data.order.length;
        for (var i = 0; i < count; i++) {
            var id = this.data.order[i];
            var line = this._spans_pull[id];
            if (line) {
                for (var j = start; j < end; j++) {
                    var cid = this._columns[j].id;
                    if (line[cid])
                        this._add_span_to_area(area, i, j, line, top, start, id, cid);
                }
            }
            top += this._getRowHeight(this.getItem(id));
        }
    },

    _paint_spans_selection: function () {
        var config = this.config.select;
        var cell = (config == "cell" || config == "column");

        var selected = this.getSelectedId(true);
        var newselected = [];
        var last = this._last_selected || [];
        var id = smdui.uid() + "";
        var repaint = false;

        for (var i = 0; i < selected.length; i++) {
            var line = this._spans_pull[selected[i]];
            if (line && (!cell || line[selected[i].column])) {
                if (!line.$selected || line.$selected.id != selected[i].id)
                    repaint = true;
                line.$selected = selected[i];
                line.$time = id;
                newselected.push(selected[i].id);
            }
        }


        for (var i = 0; i < last.length; i++) {
            var line = this._spans_pull[last[i]];
            if (line && line.$time !== id) {
                delete line.$selected;
                repaint = true;
            }
        }

        this._last_selected = [].concat(selected);
        if (repaint)
            this._paint_spans();
    },

    _span_sum_width: function (start, end) {
        var summ = 0;
        for (var i = start; i < end; i++) {
            var next = this._columns[i];
            summ += next ? next.width : 0;
        }

        return summ;
    },

    _span_sum_height: function (start, end) {
        var summ = 0;
        for (var i = start; i < end; i++) {
            var next = this.getItem(this.data.order[i]);
            summ += next ? this._getRowHeight(next) : this._settings.rowHeight;
        }

        return summ;
    },

    _add_span_to_area: function (area, ind, cind, config, top, start, id, cid) {

        var line = config[cid];
        var value = line[2] || this.getText(id, cid);
        var selected = "";
        if (config.$selected && (this._settings.select === "row" || config.$selected.column === cid))
            selected = "smdui_selected ";

        var attributes = {
            "column": cind,
            "row": ind,
            "class": selected + "smdui_cell smdui_table_cell smdui_dtable_span " + (line[3] || ""),
            "aria-colindex": cind + 1,
            "aria-rowindex": ind + 1
        };

        if (line[0] > 1) attributes["aria-colspan"] = line[0];
        if (line[1] > 1) attributes["aria-rowspan"] = line[1];

        var span = smdui.html.create("DIV", attributes, "" + value);

        span.style.top = top + "px";
        span.style.left = this._span_sum_width(start, cind) + "px";
        span.style.width = this._span_sum_width(cind, cind + line[0]) + "px";
        span.style.height = this._span_sum_height(ind, ind + line[1]) + "px";

        area.appendChild(span);
    },

    _adjust_spans_xy: function () {
        if (!this._settings.prerender) {
            var state = this.getScrollState();
            for (var i = 0; i < 3; i++)
                this._spans_areas[i].style.top = "-" + (state.y || 0) + "px";
        }
    },
    _checkCellMerge: function (id0, id1) {
        var span0, span1,
            result = false;

        if (this._spans_pull) {
            span0 = this.getSpan(id0.row, id0.column);
            span1 = this.getSpan(id1.row, id1.column);
            if (span0 && span1 && span0[0] == span1[0] && span0[1] == span1[1])
                result = true;
        }
        return result;
    }
});
smdui.extend(smdui.ui.datatable, {
    subrow_setter: function (value) {
        if (value) {
            this._init_subrow_once();
            this._settings.fixedRowHeight = false;
            return smdui.template(value);
        }
        return false;
    },
    subview_setter: function (value) {
        if (value)
            this._settings.subrow = this.subrow_setter("<div></div>");
        return value;
    },
    defaults: {
        subRowHeight: 35
    },
    _refresh_sub_all: function () {
        this.data.each(function (obj) {
            if (obj)
                obj.$sub = this._settings.subrow(obj, this.type);
        }, this);

        this._resize_sub_all();
    },
    _resize_sub_all: function (resize) {
        if (this._settings.subRowHeight === "auto" && this._content_width)
            this._adjustSubRowHeight();
        if (resize && this._settings.subview) {
            for (var key in this._subViewStorage) {
                var subview = smdui.$$(this._subViewStorage[key]);
                if (!subview._settings.hidden)
                    subview.adjust();
            }
        }
    },
    _refresh_sub_one: function (id) {
        var obj = this.getItem(id);
        obj.$sub = this._settings.subrow(obj, this.type);

        if (this._settings.subRowHeight === "auto")
            this._adjustSubRowHeight(obj.id, obj.$sub);
    },
    $init: function () {
        this._init_subrow_once = smdui.once(function () {
            var css = "#" + this._top_id + " .smdui_cell.smdui_dtable_subview { line-height:normal;}";
            //if initial fixedRowHeight is true, preserve white-space for non sub cells
            if (this._settings.fixedRowHeight)
                css += "#" + this._top_id + " .smdui_column .smdui_cell { white-space: nowrap;}";

            smdui.html.addStyle(css);

            this._subViewStorage = {};
            this.attachEvent("onSubViewRender", this._render_sub_view);
            this.data.attachEvent("onStoreUpdated", smdui.bind(function (id, data, mode) {
                if (!id)
                    this._refresh_sub_all();
                else if (mode == "update" || mode == "add")
                    this._refresh_sub_one(id);
            }, this));
            this.attachEvent("onResize", function (w, h, wo) {
                if (wo != w)
                    this._resize_sub_all(true);
            });
        });

        this.type.subrow = function (obj) {
            if (obj.$sub) {
                if (obj.$subopen)
                    return "<div class='smdui_tree_open smdui_sub_open'></div>";
                else
                    return "<div class='smdui_tree_close smdui_sub_close'></div>";
            } else
                return "<div class='smdui_tree_none'></div>";
        };
        this.on_click.smdui_sub_open = function (e, id) {
            this.closeSub(id);
            return false;
        };
        this.on_click.smdui_sub_close = function (e, id) {
            this.openSub(id);
            return false;
        };
    },
    openSub: function (id) {
        var obj = this.getItem(id);
        if (obj.$subopen) return;

        obj.$row = this._settings.subrow;
        obj.$subHeight = (obj.$subHeight || this._settings.subRowHeight);
        obj.$subopen = true;

        var sub = this._subViewStorage[obj.$subContent];
        if (sub)
            sub.repaintMe = true;

        this.refresh(id);
        this.callEvent("onSubViewOpen", [id]);
    },
    getSubView: function (id) {
        var obj = this.getItem(id);
        if (obj) {
            var sub = this._subViewStorage[obj.$subContent];
            if (sub)
                return smdui.$$(sub);
        }

        return null;
    },
    resizeSubView: function (id) {
        var view = this.getSubView(id);
        if (view)
            this._resizeSubView(this.getItem(id), view);
    },
    _resizeSubView: function (obj, view) {
        var height = view.$getSize(0, 0)[2];
        var eheight = obj.$subHeight || this._settings.subRowHeight;
        var delta = Math.abs(height - (eheight || 0));
        if (delta > 2) {
            obj.$subHeight = height;
            this.refresh(obj.id);
        }
    },
    _checkSubWidth: function (view) {
        var width = view.$width;
        // if layout
        if (view._layout_sizes) {
            var number = view._cells.length - view._hiddencells;
            if (view._vertical_orientation)
                width -= view._paddingX * 2 + 2;
            else
                width -= view._margin * (number - 1) + view._paddingX * 2 + number * 2;
        }
        return width > 0;
    },
    _render_sub_view: function (obj, row) {
        var sub = this._subViewStorage[obj.$subContent], view;
        if (sub) {
            row.firstChild.appendChild(sub);
            view = smdui.$$(obj.$subContent);
            if (!this._checkSubWidth(view))
                view.adjust();
            if (sub.repaintMe) {
                delete sub.repaintMe;
                view.config.hidden = false;
                view._render_hidden_views();
            }
        } else {
            view = smdui.ui(smdui.copy(this._settings.subview), row.firstChild);
            view.getMasterView = smdui.bind(function () { return this; }, this);
            obj.$subContent = view.config.id;
            this._subViewStorage[obj.$subContent] = view.$view;

            this.callEvent("onSubViewCreate", [view, obj]);
        }
        this._resizeSubView(obj, (view || smdui.$$(sub)));
    },
    _destroy_sub_view: function (id) {
        var obj = this.getItem(id);
        var div = this._subViewStorage[obj.$subContent];
        if (div) {
            delete obj.$subContent;
            var view = smdui.$$(div);
            if (view && view != this)
                view.destructor();
        }
    },
    _adjustSubRowHeight: function (id, text) {
        var d = smdui.html.create("DIV", { "class": "smdui_measure_size smdui_cell smdui_dtable_subrow" }, "");
        d.style.cssText = "width:" + this._content_width + "px; height:auto; visibility:hidden; position:absolute; top:0px; left:0px; overflow:hidden;";
        this.$view.appendChild(d);

        this.data.each(function (obj) {
            if (obj && !id || obj.id == id && obj.$sub) {
                d.innerHTML = text || this._settings.subrow(obj, this.type);
                obj.$subHeight = d.offsetHeight;
            }
        }, this);

        d = smdui.html.remove(d);
    },
    closeSub: function (id) {
        var obj = this.getItem(id);
        if (!obj.$subopen) return;

        obj.$row = false;
        obj.$subopen = false;

        var sub = this._subViewStorage[obj.$subContent];
        if (sub)
            smdui.$$(sub).config.hidden = true;

        this.refresh(id);
        this.callEvent("onSubViewClose", [id]);
    }
});
smdui.extend(smdui.ui.datatable, {
    headermenu_setter: function (value) {
        if (value) {
            if (value.data)
                this._preconfigured_hmenu = true;
            value = this._init_hmenu_once(value);
        }
        return value;
    },
    _init_hmenu_once: function (value) {

        var menuobj = {
            view: "contextmenu",
            template: "<span class='smdui_icon {common.hidden()}'></span> &nbsp; #value#",
            type: {
                hidden: function (obj) {
                    if (obj.hidden)
                        return "fa-empty";
                    else
                        return "fa-eye";
                }
            },
            on: {
                onMenuItemClick: smdui.bind(function (id, ev) {
                    var menu = smdui.$$(this._settings.headermenu);
                    var state = menu.getItem(id).hidden;
                    menu.getItem(id).hidden = !state;
                    menu.refresh(id);
                    menu.$blockRender = true;

                    if (state)
                        this.showColumn(id);
                    else
                        this.hideColumn(id);

                    menu.$blockRender = false;
                    return false;
                }, this)
            },
            data: []
        };
        if (typeof value == "object")
            smdui.extend(menuobj, value, true);

        var menu = smdui.ui(menuobj);

        menu.attachTo(this._header);
        this._destroy_with_me.push(menu);
        this.attachEvent("onStructureLoad", this._generate_menu_columns);
        this.attachEvent("onStructureUpdate", this._generate_menu_columns);

        this._init_hmenu_once = function (v) { return v; };
        return menu._settings.id;
    },
    _generate_menu_columns: function () {
        var column, data, hidden, i;

        var menu = smdui.$$(this._settings.headermenu);
        if (menu.$blockRender || this._preconfigured_hmenu) return;

        data = [];
        for (i = 0; i < this._columns.length; i++) {
            column = this._columns[i];
            var content = column.header[0];
            if (column.headermenu !== false && content)
                data.push({ id: column.id, value: (content.groupText || content.text) });
        }

        hidden = this.getState().hidden;
        for (i = hidden.length - 1; i >= 0; i--) {
            column = this.getColumnConfig(hidden[i]);
            var content = column.header[0];
            if (column.headermenu !== false && content)
                data.push({ id: hidden[i], value: content.text, hidden: 1 });
        }

        if (data.length)
            menu.data.importData(data);
    }
});


smdui.protoUI({
    name: "property",
    $init: function () {
        this._contentobj.className += " smdui_property";
        this._contentobj.setAttribute("role", "listbox");
        this._destroy_with_me = [];
    },
    defaults: {
        nameWidth: 100,
        editable: true
    },
    on_render: {
        checkbox: function (value, config) {
            return "<input type='checkbox' class='smdui_property_check' " + (value ? "checked" : "") + ">";
        },
        color: function (value, config) {
            return "<div class=\"smdui_property_col_val\"><div class='smdui_property_col_ind' style=\"background-color:" + (value || "#FFFFFF") + ";\"></div><span>" + value + "</span></div>";
        }
    },
    on_edit: {
        label: false
    },
    _id: "smdui_f_id",
    on_click: {
        smdui_property_check: function (ev) {
            var id = this.locate(ev);
            this.getItem(id).value = !this.getItem(id).value;
            this.callEvent("onCheck", [id, this.getItem(id).value]);
            return false;
        }
    },
    on_dblclick: {
    },
    registerType: function (name, data) {
        if (data.template)
            this.on_render[name] = data.template;
        if (data.editor)
            this.on_edit[name] = data.editor;
        if (data.click)
            for (var key in data.click)
                this.on_click[key] = data.click[key];
    },
    elements_setter: function (data) {
        this._idToLine = {};
        for (var i = 0; i < data.length; i++) {
            var line = data[i];
            if (line.type == "multiselect")
                line.optionslist = true;

            //line.type 	= 	line.type||"label";
            line.id = line.id || smdui.uid();
            line.label = line.label || "";
            line.value = line.value || "";
            this._idToLine[line.id] = i;
            this.template = this._map_options(data[i]);
        }
        return data;
    },
    showItem: function (id) {
        smdui.RenderStack.showItem.call(this, id);
    },
    locate: function (e) {
        return smdui.html.locate(arguments[0], this._id);
    },
    getItemNode: function (id) {
        return this._dataobj.childNodes[this._idToLine[id]];
    },
    getItem: function (id) {
        return this._settings.elements[this._idToLine[id]];
    },
    _get_editor_type: function (id) {
        var type = this.getItem(id).type;
        if (type == "checkbox") return "inline-checkbox";
        var alter_type = this.on_edit[type];
        return (alter_type === false) ? false : (alter_type || type);
    },
    _get_edit_config: function (id) {
        return this.getItem(id);
    },
    _find_cell_next: function (start, check, direction) {
        var row = this._idToLine[start.id];
        var order = this._settings.elements;

        if (direction) {
            for (var i = row + 1; i < order.length; i++) {
                if (check.call(this, order[i].id))
                    return order[i].id;
            }
        } else {
            for (var i = row - 1; i >= 0; i--) {
                if (check.call(this, order[i].id))
                    return order[i].id;
            }
        }

        return null;
    },
    updateItem: function (key, data) {
        data = data || {};

        var line = this.getItem(key);
        if (line)
            smdui.extend(line, data, true);

        this.refresh();
    },
    _cellPosition: function (id) {
        var html = this.getItemNode(id);
        return {
            left: html.offsetLeft + this._settings.nameWidth,
            top: html.offsetTop,
            height: html.firstChild.offsetHeight,
            width: this._data_width,
            parent: this._contentobj
        };
    },
    setValues: function (data, update) {
        if (this._settings.complexData)
            data = smdui.CodeParser.collapseNames(data);

        if (!update) this._clear();
        for (var key in data) {
            var line = this.getItem(key);
            if (line)
                line.value = data[key];
        }

        this._props_dataset = data;
        this.refresh();
    },
    _clear: function () {
        var lines = this._settings.elements;
        for (var i = 0; i < lines.length; i++)
            lines[i].value = "";
    },
    getValues: function () {
        var data = smdui.clone(this._props_dataset || {});
        for (var i = 0; i < this._settings.elements.length; i++) {
            var line = this._settings.elements[i];
            if (line.type != "label")
                data[line.id] = line.value;
        }

        if (this._settings.complexData)
            data = smdui.CodeParser.expandNames(data);

        return data;
    },
    refresh: function () {
        this.render();
    },
    $setSize: function (x, y) {
        if (smdui.ui.view.prototype.$setSize.call(this, x, y)) {
            this._data_width = this._content_width - this._settings.nameWidth;
            this.render();
        }
    },
    $getSize: function (dx, dy) {
        if (this._settings.autoheight) {
            var count = this._settings.elements.length;
            this._settings.height = Math.max(this.type.height * count, this._settings.minHeight || 0);
        }
        return smdui.ui.view.prototype.$getSize.call(this, dx, dy);
    },
    _toHTML: function () {
        var html = [];
        var els = this._settings.elements;
        if (els)
            for (var i = 0; i < els.length; i++) {
                var data = els[i];
                if (data.css && typeof data.css == "object")
                    data.css = smdui.html.createCss(data.css);

                var pre = '<div smdui_f_id="' + data.id + '"' + (data.type !== 'label' ? 'role="option" tabindex="0"' : '') + ' class="smdui_property_line ' + (data.css || '') + '">';
                if (data.type == "label")
                    html[i] = pre + "<div class='smdui_property_label_line'>" + data.label + "</div></div>";
                else {
                    var render = this.on_render[data.type],
                        content;
                    var post = "<div class='smdui_property_label' style='width:" + this._settings.nameWidth + "px'>" + data.label + "</div><div class='smdui_property_value' style='width:" + this._data_width + "px'>";
                    if (data.collection || data.options) {
                        content = data.template(data, data.value);
                    } else if (data.format)
                        content = data.format(data.value);
                    else
                        content = data.value;
                    if (render)
                        content = render.call(this, data.value, data);
                    html[i] = pre + post + content + "</div></div>";
                }
            }
        return html.join("");
    },
    type: {
        height: 24,
        templateStart: smdui.template(""),
        templateEnd: smdui.template("</div>")
    },
    $skin: function () {
        this.type.height = smdui.skin.$active.propertyItemHeight || 24;
    }
}, smdui.AutoTooltip, smdui.EditAbility, smdui.MapCollection, smdui.MouseEvents, smdui.Scrollable, smdui.SingleRender, smdui.AtomDataLoader, smdui.EventSystem, smdui.ui.view);

smdui.extend(smdui.ui.datatable, {
    _init_areaselect: function () {
        this._arSelCheckKeys = true;
        this._areaSelStorage = {};
        this.define("select", "area");
        this.attachEvent("onAfterScroll", function () {
            this.refreshSelectArea();
        });
        this.attachEvent("onAfterRender", function () {
            this.refreshSelectArea();
        });
        this.attachEvent("onBeforeColumnHide", function (column) {
            this._areaSelHiddenIndex = this.getColumnIndex(column);
        });
        this.attachEvent("onAfterColumnHide", function () {
            this._excludeColumnFromAreas(this._areaSelHiddenIndex);
        });

        this._bs_do_select = function (start, end, stopped, ev) {
            if (start.row && end.row) {
                if (stopped) {
                    this.addSelectArea(start, end, true);
                    this._arSelCheckKeys = true;
                    return false;
                }
                else {
                    if (this.callEvent("onAreaDrag", [start, end, ev])) {
                        if (!this._activeAreaSName) {
                            if (this._arSelCheckKeys && !(this._settings.multiselect && ev && ev.ctrlKey)) {
                                this.removeSelectArea();
                                this._arSelCheckKeys = false;
                            }

                        } else {
                            this._removeAreaNodes(this._activeAreaSName);
                        }
                    }
                    else
                        return false;
                }
            }
        };
        this.attachEvent("onBeforeAreaAdd", this._span_correct_range);
        smdui._event(this._body, "mousedown", this._ars_down, { bind: this });
    },
    _block_sel_flag: true,
    _excludeColumnFromAreas: function (index) {
        var areas = this._areaSelStorage;
        for (var a in areas) {
            var area = areas[a];
            if (this.getColumnIndex(area.start.column) < 0) {
                if (area.start.column == area.end.column)
                    this.removeSelectArea(area.name);
                else {
                    var id = this.columnId(index + 1);
                    if (id)
                        this._updateSelectArea(area.name, { row: area.start.row, column: id }, null);
                }
            }
            else if (this.getColumnIndex(area.end.column) < 0) {
                var id = this.columnId(index - 1);
                if (id)
                    this._updateSelectArea(area.name, null, { row: area.end.row, column: id });
            }
        }
    },
    _extendAreaRange: function (id, area, mode) {
        var sci, eci, sri, eri, ci, ri, iri, ici;

        if (area) {
            sci = this.getColumnIndex(area.start.column);
            eci = this.getColumnIndex(area.end.column);
            sri = this.getIndexById(area.start.row);
            eri = this.getIndexById(area.end.row);
            ci = this.getColumnIndex(id.column);
            ri = this.getIndexById(id.row);
            //start cell of area
            iri = this.getIndexById(area.init.row);
            ici = this.getColumnIndex(area.init.column);

            if (sci > ci || mode == "left") {
                if (mode === "left" && eci > ici) eci--;
                else sci = ci;
            }
            else if (eci <= ci || mode == "right") {
                if (mode == "right" && sci < ici) sci++;
                else eci = ci;
            }

            if (sri > ri || mode == "up") {
                if (mode == "up" && eri > iri) eri--;
                else sri = ri;
            }
            else if (eri < ri || mode == "down") {
                if (mode == "down" && sri < iri) sri++;
                else eri = ri;
            }

            var start = { row: this.getIdByIndex(sri), column: this.columnId(sci) };
            var end = { row: this.getIdByIndex(eri), column: this.columnId(eci) };

            if (this.callEvent("onBeforeBlockSelect", [start, end, true])) {
                this._updateSelectArea(area.name, start, end);
                this.callEvent("onSelectChange", []);
                this.callEvent("onAfterBlockSelect", [start, end]);
            }
        }
    },
    _updateSelectArea: function (name, start, end) {
        var area = this._areaSelStorage[name];
        if (!area)
            return false;

        var range = { start: start || area.start, end: end || area.end };
        this._span_correct_range(range);
        smdui.extend(area, range, true);

        this.refreshSelectArea();
    },
    areaselect_setter: function (value) {
        if (value) {
            this._init_areaselect();
            this._init_areaselect = function () { };
        }
        this.define("blockselect", value);
        return value;
    },
    addSelectArea: function (start, end, preserve, name, css, handle) {
        var i0, i1, j0, j1, temp;
        i0 = this.getIndexById(start.row);
        i1 = this.getIndexById(end.row);

        j0 = this.getColumnIndex(start.column);
        j1 = this.getColumnIndex(end.column);


        if (i0 > i1) {
            temp = i0;
            i0 = i1;
            i1 = temp;
        }

        if (j0 > j1) {
            temp = j0;
            j0 = j1;
            j1 = temp;
        }

        name = name || this._activeAreaSName || smdui.uid();

        this._activeAreaSName = null;

        var area = {
            start: { row: this.getIdByIndex(i0), column: this.columnId(j0) },
            end: { row: this.getIdByIndex(i1), column: this.columnId(j1) }
        };

        if (css)
            area.css = css;
        if (handle || handle === false)
            area.handle = handle;

        if (this._areaSelStorage[name]) {
            return this._updateSelectArea(name, area.start, area.end);
        }
        else {
            area.handle = true;
        }

        area.name = name;

        area.init = area.start;

        if (this.callEvent("onBeforeAreaAdd", [area])) {
            this._lastDefArea = name;
            if (!preserve)
                this.removeSelectArea();
            this._areaSelStorage[area.name] = area;
            this._selected_areas.push(area);
            this.refreshSelectArea();
            this.callEvent("onAfterAreaAdd", [area]);
            this.callEvent("onSelectChange", []);
        }
    },
    _renderSelectAreaBox: function () {
        var box = smdui.html.create("DIV");
        box.className = "smdui_area_selection_layer";
        box.style.top = this._render_scroll_shift + "px";
        return box;
    },
    refreshSelectArea: function () {
        var xr, yr, name, range,
            r0, r1, c0, c1,
            center = null, left = null, right = null,
            prerender = this._settings.prerender;

        if (!this._render_full_rows)
            return;
        // indexes of visible cols
        xr = this._get_x_range(prerender);
        // indexes of visible rows
        yr = this._get_y_range(prerender === true);

        if (!this._rselect_box) {
            this._rselect_box = this._renderSelectAreaBox();
            this._body.childNodes[1].appendChild(this._rselect_box);
            this._rselect_box_left = this._renderSelectAreaBox();
            this._body.childNodes[0].appendChild(this._rselect_box_left);
            this._rselect_box_right = this._renderSelectAreaBox();
            this._body.childNodes[2].appendChild(this._rselect_box_right);
        }

        this._rselect_box.innerHTML = "";
        this._rselect_box_left.innerHTML = "";
        this._rselect_box_right.innerHTML = "";

        var leftSplit = this._settings.leftSplit;
        var rightSplit = this._settings.rightSplit;

        for (name in this._areaSelStorage) {
            range = this._areaSelStorage[name];
            var ind = this._calcAreaSelectIndexes(range, xr, yr);
            if (ind === null) {
                this.removeSelectArea(name);
                continue;
            }
            var startIndex = this.getColumnIndex(range.start.column);
            var endIndex = this.getColumnIndex(range.end.column);
            if (ind.r0 <= ind.r1) {
                if (this._settings.topSplit && r0 >= this._settings.topSplit && r1 < this._render_scroll_top)
                    return false;
                if (startIndex < leftSplit)
                    left = this._getSelectAreaCellPositions(ind.r0, startIndex, ind.r1, Math.min(endIndex, leftSplit - 1));
                if (ind.c0 <= ind.c1)
                    center = this._getSelectAreaCellPositions(ind.r0, ind.c0, ind.r1, ind.c1);
                if (rightSplit && endIndex >= this._rightSplit)
                    right = this._getSelectAreaCellPositions(ind.r0, Math.max(startIndex, this._rightSplit), ind.r1, endIndex);

                if (left || center || right)
                    this._setSelectAreaBorders(left, center, right, name, range.css, range.handle);
            }
        }
    },
    _calcAreaSelectIndexes: function (range, xr, yr) {
        var r0, r1, c0, c1;

        var startIndex = this.getIndexById(range.start.row);
        var endIndex = this.getIndexById(range.end.row);

        var startColumn = this.getColumnIndex(range.start.column);
        var endColumn = this.getColumnIndex(range.end.column);

        //return null for broken select areas
        if (startColumn === -1 || endColumn === -1)
            return null;
        if (startIndex === -1 || endIndex === -1)
            return null;

        r1 = Math.min(yr[1], endIndex);
        if (this._settings.topSplit) {
            r0 = startIndex;
            if (r0 >= this._settings.topSplit)
                r0 = Math.max(yr[0] - this._settings.topSplit, startIndex);
            if (r1 >= this._settings.topSplit) {
                var endPos = this._cellPosition(this.getIdByIndex(endIndex), range.end.column);
                var splitPos = this._cellPosition(this.getIdByIndex(this._settings.topSplit - 1), range.end.column);
                if (splitPos.top + splitPos.height > (endPos.top + endPos.height))
                    r1 = this._settings.topSplit - 1;
            }
        }
        else
            r0 = Math.max(yr[0], this.getIndexById(range.start.row));

        c0 = Math.max(xr[0], startColumn);
        c1 = Math.min(this._rightSplit ? xr[1] - 1 : xr[1], endColumn);

        return { r0: r0, r1: r1, c0: c0, c1: c1 };
    },
    _getSelectAreaCellPositions: function (i0, j0, i1, j1) {
        var start = this._cellPosition(this.getIdByIndex(i0), this.columnId(j0));
        var end = this._cellPosition(this.getIdByIndex(i1), this.columnId(j1));
        return [start, end];
    },
    _setSelectAreaBorders: function (left, center, right, name, css, handle) {

        var handleBox, handlePos,
            area = this._areaSelStorage[name],
            offset = 0;

        if (this._settings.topSplit)
            offset = this._getTopSplitOffset(area.start, true);

        //include split in calcs
        var renderArea = function (parentNode, start, end, skipLeft, skipRight) {
            var bName, height, width, top, left, hor,
                borders = { "top": 1, "right": 1, "bottom": 1, "left": 1 };
            if (skipLeft)
                delete borders.left;
            if (skipRight)
                delete borders.right;
            height = end.top - start.top + end.height - 1;
            width = end.left - start.left + end.width;

            for (bName in borders) {
                top = start.top + offset;

                if (bName == "bottom")
                    top = end.top + end.height;

                left = start.left;
                if (bName == "right") {
                    left = end.left + end.width;
                }

                hor = (bName == "top" || bName == "bottom");

                parentNode.appendChild(smdui.html.create("DIV", {
                    "class": "smdui_area_selection smdui_area_selection_" + bName + (css ? " " + css : ""),
                    "style": "left:" + left + "px;top:" + top + "px;" + (hor ? ("width:" + width + "px;") : ("height:" + (height - offset) + "px;")),
                    "smdui_area_name": name
                }, ""));
                var elem = parentNode.lastChild;
                if (bName == "right")
                    elem.style.left = left - elem.offsetWidth + "px";
                if (bName == "bottom")
                    elem.style.top = top - elem.offsetHeight + "px";
            }
        };

        if (right)
            renderArea(this._rselect_box_right, right[0], right[1], !!center, false);
        if (center)
            renderArea(this._rselect_box, center[0], center[1], !!left, !!right);
        if (left)
            renderArea(this._rselect_box_left, left[0], left[1], false, !!center);

        if (handle) {
            handlePos = right ? right[1] : (center ? center[1] : left[1]);
            handleBox = right ? this._rselect_box_right : (center ? this._rselect_box : this._rselect_box_left);
            handleBox.appendChild(smdui.html.create("DIV", {
                "class": "smdui_area_selection_handle" + (css ? " " + css : ""),
                "style": "left:" + (handlePos.left + handlePos.width) + "px;top:" + (handlePos.top + handlePos.height) + "px;",
                "smdui_area_name": name
            }, ""));
        }

    },
    _removeAreaNodes: function (name) {
        if (name) {
            var removeNodes = function (parentNode) {
                var nodes = parentNode.childNodes;
                for (var i = nodes.length - 1; i >= 0; i--) {
                    if (nodes[i].getAttribute("smdui_area_name") == name) {
                        parentNode.removeChild(nodes[i]);
                    }
                }
            };
            removeNodes(this._rselect_box);
            removeNodes(this._rselect_box_left);
            removeNodes(this._rselect_box_right);
        }
    },
    removeSelectArea: function (name) {
        if (name) {
            if (this.callEvent("onBeforeAreaRemove", [name])) {
                delete this._areaSelStorage[name];
                this._removeAreaNodes(name);
                //reconstruct selected areas
                this._selected_areas = [];
                for (var key in this._areaSelStorage)
                    this._selected_areas.push(this._areaSelStorage[key]);

                this.callEvent("onAfterAreaRemove", [name]);
            }
        }
        else {
            for (var n in this._areaSelStorage)
                this.removeSelectArea(n);
        }
    },
    _ars_down: function (e) {
        var src = e.target || e.srcElement;
        var css = smdui.html._getClassName(src);
        if (css && css.indexOf("smdui_area_selection_handle") != -1) {
            var name = src.getAttribute("smdui_area_name");
            this._activeAreaSName = name;
            // show block selection
            var area = this._areaSelStorage[name];
            var pos0 = this._cellPosition(area.start.row, area.start.column);
            var pos1 = this._cellPosition(area.end.row, area.end.column);

            var prerender = this._settings.prerender;

            var xCorrStart = this.getColumnIndex(area.start.column) < this._settings.leftSplit ? 0 : this._left_width;
            var xCorrEnd = this.getColumnIndex(area.end.column) < this._settings.leftSplit ? 0 : this._left_width;

            this._bs_ready = [pos0.left + 1 + xCorrStart - this._scrollLeft, pos0.top + 1 - (prerender ? this._scrollTop : 0), {
                row: area.start.row, column: area.start.column
            }];

            this._bs_start(e);
            this._bs_progress = [pos1.left + 1 + xCorrEnd - this._scrollLeft, pos1.top + 1 - (prerender ? this._scrollTop : 0)];
            this._bs_select(false, false);
            return smdui.html.preventEvent(e);
        }
    },
    getSelectArea: function (name) {
        return this._areaSelStorage[name || this._lastDefArea];
    },
    getAllSelectAreas: function () {
        return this._areaSelStorage;
    },
    _span_correct_range: function (range) {
        if (!this.config.spans) return true;
        var i, j, c0, c1, r0, r1,
            span, spanR0, spanC0,
            minR0, minC0, maxR1, maxC1,
            changed = false,
            start = range.start,
            end = range.end;

        minR0 = r0 = this.getIndexById(start.row);
        minC0 = c0 = this.getColumnIndex(start.column);
        maxR1 = r1 = this.getIndexById(end.row);
        maxC1 = c1 = this.getColumnIndex(end.column);

        for (i = r0; i <= r1; i++) {
            for (j = c0; j <= c1; j++) {
                span = this.getSpan(this.getIdByIndex(i), this.columnId(j));
                if (span) {
                    spanR0 = this.getIndexById(span[0]);
                    spanC0 = this.getColumnIndex(span[1]);
                    if (spanR0 < minR0) {
                        minR0 = spanR0;
                        changed = true;
                    }
                    if (spanC0 < minC0) {
                        changed = true;
                        minC0 = spanC0;
                    }
                    if (spanR0 + span[3] - 1 > maxR1) {
                        changed = true;
                        maxR1 = spanR0 + span[3] - 1;
                    }
                    if (spanC0 + span[2] - 1 > maxC1) {
                        changed = true;
                        maxC1 = spanC0 + span[2] - 1;
                    }
                }
            }
        }
        if (changed) {
            range.start = { row: this.getIdByIndex(minR0), column: this.columnId(minC0) };
            range.end = { row: this.getIdByIndex(maxR1), column: this.columnId(maxC1) };
            this._span_correct_range(range);
        }
    }
});

smdui.extend(smdui.ui.datatable, {
    getValue: function () {
        var pullobj = this.data.pull;
        var items = [];
        for (var a in pullobj) {
            items.push(pullobj[a]);
        }
        return items;
    },
    setValue: function (datas) {
        this.clearAll();
        this.parse(datas,"json");
    }
});