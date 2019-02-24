
# -*- coding: utf-8 -*-
###############################################################################
#
#    Odoo, Open Source Management Solution
#
#    Copyright (c) All rights reserved:
#        (c) 2015  TM_FULLNAME
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see http://www.gnu.org/licenses
#
###############################################################################
{
    "name": """POS Stock Transfer""",
    "summary": """Stock Transfer from POS to Internal Locations""",
    "category": "Point of Sale",
    "images": ['images/pos_cashier_select.png'],
    "version": "10.0.1.0.0",
    "application": False,
    "author": "Ananthu Krishna",
    "support": "ananthu.krishna@gamil.com",
    "website": "https://wwww.codersfort.com",
    "depends": [
        "point_of_sale",
    ],
    "data": [
        "views/views.xml",
    ],
    "qweb": [
        "static/src/xml/pos.xml",
    ],
    "auto_install": False,
    "installable": True,
}
