function VariantEffectPanelWidget(args) {
    _.extend(this, Backbone.Events);
    this.id = Utils.genId("VariantEffectPanelWidget");

    this.storeConfig = {};
    this.gridConfig = {};
    this.filterEffect = true;

    _.extend(this, args);

    this.on(this.handlers);

    this.rendered = false;

    if (this.autoRender) {
        this.render(this.targetId);
    }
}

VariantEffectPanelWidget.prototype = {
    render: function (targetId) {
        var _this = this;

        _this.targetId = (targetId) ? targetId : this.targetId;

        var storeArgs = {
            storeId: "EffectStore",
            groupField: 'featureId',
            fields: [
                {name: "featureId"           , type: "string" },
                {name: "featureName"         , type: "string" },
                {name: "featureType"         , type: "string" },
                {name: "featureBiotype"      , type: "string" },
                {name: "featureChromosome"   , type: "string" },
                {name: "featureStart"        , type: "int"    },
                {name: "featureEnd"          , type: "int"    },
                {name: "featureStrand"       , type: "string" },
                {name: "snpId"               , type: "string" },
                {name: "ancestral"           , type: "string" },
                {name: "alternative"         , type: "string" },
                {name: "geneId"              , type: "string" },
                {name: "transcriptId"        , type: "string" },
                {name: "geneName"            , type: "string" },
                {name: "consequenceType"     , type: "string" },
                {name: "consequenceTypeObo"  , type: "string" },
                {name: "consequenceTypeDesc" , type: "string" },
                {name: "consequenceTypeType" , type: "string" },
                {name: "aaPosition"          , type: "int"    },
                {name: "aminoacidChange"     , type: "string" },
                {name: "codonChange"         , type: "string" },
                {name: "polyphenScore"       , type: "number"  },
                {name: "polyphenEfect"       , type: "number"  },
                {name: "siftScore"           , type: "number"  },
                {name: "siftEffect"          , type: "number"  },
            ],
            data: [],
            autoLoad: false,
            proxy: {type: 'memory'}
        }

        _.extend(storeArgs, _this.storeConfig);

        _this.store = Ext.create("Ext.data.Store", storeArgs);


        var gridArgs = {
            targetId: _this.targetId,
            title: "Variant Effect",
            store: this.store,
            loadMask: true,
            collapsible:true,
            titleCollapse:true,
            collapseDirection:'bottom',
            columns: [
                {xtype: 'rownumberer'},
                {
                    text: "Position chr:start:end (strand)",
                    dataIndex: "featureChromosome",
                    xtype: "templatecolumn",
                    tpl: '{featureChromosome}:{featureStart}-{featureEnd} <tpl if="featureStrand == 1">(+)<tpl elseif="featureStrand == -1">(-)</tpl>',
                    flex: 1
                },
                {
                    text: "SNP Id",
                    dataIndex: "snpId",
                    flex: 1
                },
                {
                    text: "Conseq. Type",
                    dataIndex: "consequenceTypeObo",
                    xtype: "templatecolumn",
                    tpl: '{consequenceTypeObo} (<a href="http://www.sequenceontology.org/browser/current_svn/term/{consequenceType}" target="_blank">{consequenceType}</a>)',
                    flex: 1
                },
                {
                    text: "Aminoacid Change",
                    xtype: "templatecolumn",
                    tpl: '<tpl if="aminoacidChange">{aminoacidChange} - {codonChange} ({aaPosition}) <tpl else>.</tpl>  ',
                    flex: 1
                },
                {
                    text: "Gene (EnsemblId)",
                    dataIndex: "geneName",
                    xtype: 'templatecolumn',
                    tpl: '<tpl if="geneName">{geneName} (<a href="http://www.ensembl.org/Homo_sapiens/Location/View?g={geneId}" target="_blank">{geneId}</a>)<tpl else>.</tpl>',
                    flex: 1
                },
                {
                    text: "Transcript Id",
                    dataIndex: "transcriptId",
                    xtype: 'templatecolumn',
                    tpl: '<a href="http://www.ensembl.org/Homo_sapiens/Location/View?t={transcriptId}" target="_blank">{transcriptId}</a>',
                    flex: 1
                },
                {
                    text: "Feature Id",
                    dataIndex: "featureId",
                    flex: 1

                },
                {
                    text: "Feature Name",
                    dataIndex: "featureName",
                    flex: 1

                },
                {
                    text: "Feature Type",
                    dataIndex: "featureType",
                    flex: 1

                },
                {
                    text: "Feature Biotype",
                    dataIndex: "featureBiotype",
                    flex: 1

                },
                {
                    text: "Ancestral",
                    dataIndex: "ancestral",
                    hidden: true,
                    flex: 1
                },
                {
                    text: "Alternative",
                    dataIndex: "alternative",
                    hidden: true,
                    flex: 1
                }
            ],
            viewConfig: {
                emptyText: 'No records to display'
            },
            dockedItems: [
                {
                    xtype: 'toolbar',
                    dock: 'bottom',
                    items: [
                        {
                            xtype: 'tbtext',
                            id: _this.id + "numRowsLabelEffect"
                        }
                    ]
                }
            ]
        }

        _.extend(gridArgs, _this.gridConfig);

        _this.grid = Ext.create('Ext.grid.Panel', gridArgs);

    },
    draw: function () {


    },
    getPanel: function () {
        return this.grid;
    },
    clear: function () {
        this.store.removeAll();
    },
    load: function (chr, pos, ref, alt) {

        var _this = this;
        var req = chr + ":" + pos + ":" + ref + ":" + alt;

        _this.grid.setLoading(true);
        _this.clear();

        CellBaseManager.get({
           host: "http://ws.bioinfo.cipf.es/cellbase/rest",
           version:'latest',
            species:'hsa',
            category: 'genomic',
            subCategory:'variant',
            query: req,
            resource: 'consequence_type',
            success: function(response){
                var data = (_this.filterEffect) ? _this._filterEffectData(response): response;

                _this.store.loadData(data);
                _this.grid.setTitle(_this.gridName + ' - <span class="info">' + chr + ':' + pos + ' ' + ref + '>' + alt + '</span>');
                Ext.getCmp(_this.id + "numRowsLabelEffect").setText(data.length + " effects");
        
                _this.grid.setLoading(false);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log('Error loading Effect');
                _this.grid.setLoading(false);
            }
        });
    },
    _filterEffectData: function (data) {
        var _this = this;
        var res = [];

        var regulatory = {};

        for (var i = 0; i < data.length; i++) {
            var elem = data[i];
            if (elem.consequenceTypeObo == "coding_sequence_variant" || elem.consequenceTypeObo == "exon_variant" || elem.consequenceTypeObo == "intron_variant") {
                continue;
            } else if (elem.consequenceTypeObo == "regulatory_region_variant") {
                if (!(elem.featureId in regulatory)) {
                    regulatory[elem.featureId] = elem;
                }
                continue;
            }

            res.push(elem);
        }

        for (var elem in regulatory) {
            res.push(regulatory[elem]);
        }

        return res;
    }
}
