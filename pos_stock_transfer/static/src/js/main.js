odoo.define('pos_stock_transfer', function(require){
    "use strict";

    var gui = require('point_of_sale.gui');
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var popups = require('point_of_sale.popups');
    var chrome = require('point_of_sale.chrome');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var models = require('point_of_sale.models');
    var Model = require('web.DataModel');
    var QWeb = core.qweb;
    var _t = core._t;
    
    
    
    models.load_models({
        model:  'product.product',
        fields: ['id','name'],        
        loaded: function(self,products){            
            self.products = products;
        },
    });
    
    models.load_models({
        model:  'stock.location',
        fields: ['id','display_name'],
        domain: [['usage','=','internal']],
        loaded: function(self,locations){            
            self.locations = locations;
        },
    });
    
    
    models.load_models({
        model: 'stock.picking',
        fields: ['id', 'name', 'location_id', 'location_dest_id','move_lines',],
        domain: [['picking_type_id','=','Internal Transfers'],['state','=','assigned']],
        loaded: function (self, stock_picking) {                     
            self.stock_picking = stock_picking;
        },
    });

    
    var StockTransferButton = screens.ActionButtonWidget.extend({
        template: 'StockTransferButton',        
        button_click: function(){            
            this.gui.show_popup('stock_transer');
        },
    });

    
    var StockTransferReceiveButton = screens.ActionButtonWidget.extend({
        template: 'StockTransferReceiveButton',
        button_click: function(){                        
            this.gui.show_screen('receive_stock_transer');           
        },
        
    });
    
    screens.define_action_button({
        'name': 'Stock Transfer',
        'widget': StockTransferButton,
        'condition': function(){
            return this.pos;
        },
    });

    screens.define_action_button({
        'name': 'Recive Transfer',
        'widget': StockTransferReceiveButton,
        'condition': function(){
            return this.pos;
        },
    });

    var DomCache = core.Class.extend({
        init: function(options){
            options = options || {};
            this.max_size = options.max_size || 2000;
    
            this.cache = {};
            this.access_time = {};
            this.size = 0;
        },
        cache_node: function(key,node){
            var cached = this.cache[key];
            this.cache[key] = node;
            this.access_time[key] = new Date().getTime();
            if(!cached){
                this.size++;
                while(this.size >= this.max_size){
                    var oldest_key = null;
                    var oldest_time = new Date().getTime();
                    for(key in this.cache){
                        var time = this.access_time[key];
                        if(time <= oldest_time){
                            oldest_time = time;
                            oldest_key  = key;
                        }
                    }
                    if(oldest_key){
                        delete this.cache[oldest_key];
                        delete this.access_time[oldest_key];
                    }
                    this.size--;
                }
            }
            return node;
        },
        clear_node: function(key) {
            var cached = this.cache[key];
            if (cached) {
                delete this.cache[key];
                delete this.access_time[key];
                this.size --;
            }
        },
        get_node: function(key){
            var cached = this.cache[key];
            if(cached){
                this.access_time[key] = new Date().getTime();
            }
            return cached;
        },
    });


    var StockTransferWidget = PosBaseWidget.extend({
        template: 'StockTransferWidget',
        init: function(parent, args) {
            this._super(parent, args);
            this.options = {};                   
        },
        events: {
            'click .button.cancel':  'click_cancel',
            'click .button.confirm': 'click_confirm',
            'click .button.delete-row': 'delete_row',
            'click .button.add-row': 'add_row',
        },
        show: function(options){
            options = options || {};
            var self = this;
            this._super(options);
            
            var products = [];
            for (var i in self.pos.products){
                products.push({
                    'id':self.pos.products[i].id,
                    'name':self.pos.products[i].name,                    
                });
            }
            this.products    = products    || [];

            var locations = [];
            for (var i in self.pos.locations){
                locations.push({
                    'id':self.pos.locations[i].id,
                    'name':self.pos.locations[i].display_name,                    
                });
            }
            this.locations    = locations    || [];

            var source_location = self.pos.config.stock_location_id[1];
            this.source_location = source_location || [];

            var source_location_id = self.pos.config.stock_location_id[0];        
            this.source_location_id = source_location_id || [];
            this.renderElement();       
            
        },    
        close: function(){
            if (this.pos.barcode_reader) {
                this.pos.barcode_reader.restore_callbacks();
            }
        },
        click_cancel: function(){            
            this.$(".line_container tr").empty(); 
            this.gui.close_popup();
        },
        delete_row : function(){            
            this.$("table tbody").find('input[name="record"]').each(function(){
                if($(this).is(":checked")){
                    $(this).parents("tr").remove();
                }
            });            
        },
        add_row : function(){            
            var lines = $(QWeb.render('StockTransferLines', { widget:this }));
            this.$(".line_container").append(lines);
            $("select.products").searchable();
        },
        click_confirm: function(){
            var self = this;
            var products = [];
            var location_dest_id = this.$('.locations').val();
            var location_id = this.source_location_id;
            var total_prodcuts = 0;
            var total_lines = 0;

            this.$('.line_container tr').each(function() {
                var product_id = $(this).find(".products").val();
                var quantity = $(this).find(".quantity").val();                
                if ((product_id) && (quantity > 0)){
                    products.push({
                        'product_id':product_id,
                        'quantity':quantity,
                        'location_id':location_id,
                        'location_dest_id':location_dest_id,
                    })
                    total_prodcuts += 1;
                }
                total_lines += 1;
            });
            
            if ((total_prodcuts === total_lines) && ((total_prodcuts > 0) && (total_lines>0))){                
                new Model('stock.picking').call('create_pos_stock_transfer',[1,products]).then(function(result){
                    //console.log('Stock Transfer Initiated the Pyhton Create Function');
                });
                this.gui.close_popup();
                self.gui.show_popup('confirm',{
                    title :_t('Stock Transfer Created'),
                    body  :_t('stock transfer created for selected products'),
                });                 
            }
        },
        renderElement: function() {
            var self = this;
            this._super();
            $("select.locations").searchable();
        }              
    })
    gui.define_popup({name:'stock_transer', widget: StockTransferWidget});


    var ReceiveStockTransferWidget = screens.ScreenWidget.extend({
        template: 'ReceiveStockTransferWidget',

        init: function(parent, options){
            this._super(parent, options);
            this.stock_cache = new DomCache();
            this.stock_receive_string = "";
        },
        auto_back: true,
        hide: function () {
            this._super();
            this.new_client = null;
        },    
        renderElement: function () {
            this._super(this);
            var self = this;    
        },        
        show: function(){
            var self = this;
            this._super();
            this.renderElement();
            this.$('.back').click(function(){
                self.gui.back();
            });
            var stock_picking = self.pos.stock_picking;            
            this.render_list(stock_picking);
            var search_timeout = null;
            if(this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard){
                this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
            this.$('.searchbox input').on('keypress',function(event){                
                clearTimeout(search_timeout);
                var searchbox = this;
                search_timeout = setTimeout(function(){                         
                    self.perform_search(searchbox.value, event.which === 13);
                },70);
            });
            this.$('.searchbox .search-clear').click(function(){
                self.clear_search();
            });            
        },
        perform_search: function(query, associate_result){                      
            var stock_picking;
            if(query){
                stock_picking = this.search_order(query);
                this.render_list(stock_picking);
            }
            else{
                var stock_picking = this.pos.stock_picking;
                this.render_list(stock_picking);
            }
        },

        search_order: function(query){           
            var self = this;
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g,'.');
                query = query.replace(' ','.+');
                var re = RegExp("([0-9]+):.*?"+query,"gi");
            }catch(e){
                return [];
            }
            var results = [];
            for(var i = 0; i < self.pos.stock_picking.length; i++){
                var r = re.exec(this.stock_receive_string);
                if(r){
                    var id = Number(r[1]);
                    results.push(this.get_stock_by_id(id));
                }else{
                    break;
                }
            }
            return results;
        },
        
        get_stock_by_id: function (id) {
            return this.pos.stock_picking[id];
        },

        clear_search: function(){            
            var stock_picking = this.pos.stock_picking;
            this.render_list(stock_picking);
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },

        render_list: function(stock_picking){
            var self = this;
            for(var i = 0, len = stock_picking.length; i < len; i++) {
                if (stock_picking[i]) {
                    var picking = stock_picking[i];
                    self.stock_receive_string += i + ':' + picking.name + '\n';
                }
            }
            var contents = this.$el[0].querySelector('.receive-transfer-list-lines');
            contents.innerHTML = "";
            if (contents){                
                for(var i = 0, len = stock_picking.length; i < len; i++) {
                    if (stock_picking[i]) {
                        var stock_pick = stock_picking[i];
                        var stockline = this.stock_cache.get_node(stock_pick.id);                                                                        
                        if (!stockline) {
                            var clientline_html = QWeb.render('ReceiveStockLines', {widget: this, picking: stock_picking[i]});
                            var stockline = document.createElement('tbody');
                            stockline.innerHTML = clientline_html;
                            stockline = stockline.childNodes[1];
                            if (stock_pick.id){
                                this.stock_cache.cache_node(stock_pick.id, stockline);
                            }
                            else{
                                this.stock_cache.cache_node(i, stockline);
                            }
                        }
                        contents.appendChild(stockline);
                    }
                }
            }
            
            this.$('.receive-transfer-list-lines').delegate('.receive-stock-button','click',function(event){                    
                    var receive_stock_ref = $(this).data('id');
                    

                    var receive_stock_new = null;
                    for(var i = 0, len = stock_picking.length; i < len; i++) {
                        if (stock_picking[i] && stock_picking[i].id == receive_stock_ref) {
                            receive_stock_new = stock_picking[i];
                        }
                    }
                    
                    if (receive_stock_new){
                        self.gui.show_popup('receive_stock_transer_lines',{
                            ref: receive_stock_new
                        });
                    }

            });

        },
        close: function(){
            this._super();
        },

    })
    gui.define_screen({name:'receive_stock_transer', widget: ReceiveStockTransferWidget});

    var ReceiveStockTransferLinesWidget = PosBaseWidget.extend({
        template: 'ReceiveStockTransferPopupWidget',

        init: function(parent, options){
            this._super(parent, options);
            this.stock_cache = new DomCache();
        },

        show: function (options) {
            var self = this;
            this._super(options);

            var stock_picking = this.pos.stock_picking;
            this.render_list(options);
    
        },
        close: function(){
            if (this.pos.barcode_reader) {
                this.pos.barcode_reader.restore_callbacks();
            }
        },
        events: {
            'click  button.cancel':  'click_cancel',
            'click  button.confirm': 'click_confirm',
            'change input.received_quantity': 'change_received_quantity',
        },

        render_list:function(options){
            var self =  this;
            var order_new = null;
            $("#received_product_lines").empty();
            var picking_lines = [];
            this.receive_stock_new = options.ref
            new Model('stock.picking').call('get_picking_lines',[options.ref]).then(function(result){                
                if ((result.length)>0) {
                    for(var j=0;j < result.length; j++){
                        var product_line = result[j];
                        var product_id = product_line.product_id                    
                        var product =product_line.product;
                        var ordered_qty = product_line.ordered_qty;

                        var lines = $(QWeb.render('ReceiveStockTransferPopupLines', { 
                            widget: this,
                            product_line:product_line,
                        }));
                        self.$("#received_product_lines").append(lines);          
                    }
                }                
            });
        },
        remove_picking_by_id: function(picking_id){                                               
            for (var i = 0; i < this.pos.stock_picking.length; i++) {	
                var obj = this.pos.stock_picking[i];	
                if(obj.id == picking_id){                    
                    this.pos.stock_picking.splice(i);
                }
            }
            return;
        },
        click_confirm : function(){
            var self = this;
            var picking_id = this.receive_stock_new;            
            var picking_data = []
            var total_prodcuts = 0;
            var total_received_quantity= 0;
            this.$('#received_product_lines tr').each(function() {                
                var product_id = $(this).find('.product_id').data('cid');            
                var received_quantity = parseInt($(this).find('.received_quantity').val());
                if ((received_quantity >= 0) && (received_quantity !== 'NaN')){
                    picking_data.push({
                        'product_id':product_id,
                        'received_quantity':received_quantity,
                        'picking_id':picking_id['id'],
                    })
                    total_received_quantity += received_quantity;                  
                }
                total_prodcuts += 1;
            });
            
            if ((picking_data.length) === (total_prodcuts) && (total_prodcuts !== 0) && (total_received_quantity !== 0)){
                new Model('stock.picking').call('validate_pos_stock_transfer',[1,picking_data]).then(function(result){
                    //console.log('Stock Transfer Validted the Pyhton Create Function');
                });
                this.gui.close_popup();
                this.remove_picking_by_id(picking_id['id']);
                $('.receive-transfer-list-lines tr').each(function(){                    
                    if ($(this).data('id') == picking_id['id']){
                        $(this).addClass('oe_hidden');
                    }
                });
                self.gui.show_screen('receive_stock_transer');
            }
        },
        click_cancel: function(){            
            this.gui.close_popup();
        },
        change_received_quantity: function(e){
            var self = this;            
            var ordered_qty = parseInt(e.target.value)
            var received_quantity = parseInt(e.target.dataset.qty)
            if (received_quantity < ordered_qty){
                e.target.value  = '';
            }                    
        },
    })
    gui.define_popup({name:'receive_stock_transer_lines', widget: ReceiveStockTransferLinesWidget});
});