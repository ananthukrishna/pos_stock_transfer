
# -*- coding: utf-8 -*-
###############################################################################
#    License, author and contributors information in:                         #
#    __manifest__.py file at the root folder of this module.                  #
###############################################################################

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError
from itertools import groupby
from operator import itemgetter
from ast import literal_eval
import json


class Picking(models.Model):
    _inherit = "stock.picking"

    is_from_pos = fields.Boolean(string='Created form POS',)
    

    @api.multi
    def create_pos_stock_transfer(self,vals):        
        if vals:
            pick_data = []
            location_id = []
            location_dest_id = []
            for record in vals:
                pick_lines = [0,False]
                
                product_id = record['product_id']
                product_uom_qty = record['quantity']
                product_uom = self.env['product.product'].sudo().search([('id','=',product_id)]).uom_id.id
                name = self.env['product.product'].sudo().search([('id','=',product_id)]).name

                pick_line_values= {
                    'name': name,
                    'product_id': product_id,
                    'product_uom_qty': product_uom_qty,
                    'product_uom': product_uom,
                    'state': 'draft',
                }
                pick_lines.append(pick_line_values)
                pick_data.append(pick_lines)

                location_id.append(record['location_id'])
                location_dest_id.append(record['location_dest_id'])

            picking = {
                'location_id': list(set(location_id))[0],
                'location_dest_id': list(set(location_dest_id))[0],
                'move_type':'direct',            
                'picking_type_id': 5,
                'is_from_pos': True,
                'move_lines':pick_data,
            }
            transfer = self.env['stock.picking'].sudo().create(picking)
            if transfer:
                transfer.sudo().action_confirm()
                transfer.sudo().action_assign()
    
    
    @api.model
    def get_picking_lines(self, ref):
        result = []
        picking_id = self.search([('id', '=', ref['id'])], limit=1)
        
        if picking_id:
            lines = self.env['stock.move'].search([('picking_id', '=', picking_id.id)])
            for line in lines:        
                new_vals = {
                    'product_id': str(line.product_id.id),
                    'product': line.product_id.name,
                    'ordered_qty': line.ordered_qty,
                }                
                result.append(new_vals)
        
        #Merging Muliple lines of Same products
        result2 = []
        result = literal_eval(json.dumps(result))
        grouper = itemgetter("product_id","product")        
        for key, grp in groupby(sorted(result, key = grouper), grouper):
            temp_dict = dict(zip(["product_id", "product","ordered_qty"], key))
            temp_dict["ordered_qty"] = sum(item["ordered_qty"] for item in grp)
            result2.append(temp_dict)
        return result2
    
    @api.multi
    def validate_pos_stock_transfer(self,vals):
        if vals:
            picking_id = [record['picking_id'] for record in vals][0]
            stock_picking_obj = self.env['stock.picking'].search([('id','=',picking_id)])   
            if stock_picking_obj:
                for val in vals:
                    stock_pack_obj = self.env['stock.pack.operation'].search([('picking_id','=',picking_id),('product_id','=',val['product_id'])])        
                    if stock_pack_obj:
                        move = stock_pack_obj.sudo().write({
                            'qty_done':val['received_quantity'],
                        })            
            if stock_picking_obj.check_backorder():
                wiz = self.env['stock.backorder.confirmation'].sudo().create({'pick_id': picking_id})
                wiz.sudo().process()
            else:
                do_new_transfer = stock_picking_obj.sudo().do_new_transfer()



