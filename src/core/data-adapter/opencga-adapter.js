/*
 * Copyright (c) 2016 Pedro Furio (Genomics England)
 * Copyright (c) 2016 Asunción Gallego (CIPF)
 * Copyright (c) 2016 Ignacio Medina (University of Cambridge)
 *
 * This file is part of JS Common Libs.
 *
 * JS Common Libs is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * JS Common Libs is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with JS Common Libs. If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Created by pfurio on 16/11/16.
 */

class OpencgaAdapter extends FeatureAdapter {

    constructor(client, category, subcategory, resource, params = {}, options = {}, handlers = {}) {
        super();

        this.client = client;
        this.category = category;
        this.subCategory = subcategory;
        this.resource = resource;
        this.params = params;
        this.options = options;
        this.handlers = handlers;

        const CHUNK_SIZE_DEFAULT = 2000;

        if (typeof this.options.chunkSize === "undefined" || this.options.chunkSize === 0) {
            this.options.chunkSize = CHUNK_SIZE_DEFAULT;
        }

        Object.assign(this, Backbone.Events);
        this.on(this.handlers);
    }
    // Deprecated method
    setSpecies(species) {
            // this.species = species;
    }

    getData(args){
        switch(this.category) {
            case "analysis/variant":
                return this._getVariant(args);
                break;
            case "analysis/alignment":
                return this._getAlignmentData(args);
                break;
            default:
                return this._getExpressionData(args);
        }
    }

    _getExpressionData(args){
        //TODO check with expression data
        console.log("In GetExpressionData");
        let _this = this;
        let params = {};

        Object.assign(params, this.params, args.params);

        /** 4 chunkSize check **/
        let chunkSize = params.interval ? params.interval : this.options.chunkSize; // this.cache.defaultChunkSize should be the same
        if (this.debug) {
            console.log(chunkSize);
        }

        return new Promise(function(resolve, reject) {
            // Create the chunks to be retrieved
            let start = _this._getStartChunkPosition(region.start);
            let end = _this._getStartChunkPosition(region.end);

            let regions = [];
            let myRegion = start;
            args.webServiceCallCount = 0;

            do {
                regions.push(`${region.chromosome}:${myRegion}-${myRegion + _this.options.chunkSize - 1}`);
                myRegion += _this.options.chunkSize;
            } while(myRegion < end);

            let groupedRegions = _this._groupQueries(regions);
            let chunks = [];
            for (let i = 0; i < groupedRegions.length; i++) {
                args.webServiceCallCount++;
                _this.client.get(_this.category, _this.subCategory, groupedRegions[i], _this.resource, params)
                    .then(function (response) {
                        let responseChunks = _this._generalOpencgaSuccess(response, dataType, chunkSize);
                        args.webServiceCallCount--;

                        chunks = chunks.concat(responseChunks);
                        if (args.webServiceCallCount === 0) {
                            chunks.sort(function (a, b) {
                                return a.chunkKey.localeCompare(b.chunkKey);
                            });
                            resolve({items: chunks, dataType: dataType, chunkSize: chunkSize, sender: _this});
                        }
                    })
                    .catch(function () {
                        reject("Server error");
                    });
            }
        });
    }

    _getVariant(args){
        console.log("OpenCGA Data Adapter: fetching Variants");

        let params = {};
        Object.assign(params, this.params, args.params);

        /** 1 region check **/
        let region = args.region;
        region = super._checkRegion(region);

        /** 2 dataType check **/
        let dataType = args.dataType;
        if (_.isUndefined(dataType)) {
            console.error("dataType must be provided!!!");
            return;
        }

        /** 3 chunkSize check **/
        let chunkSize = params.interval ? params.interval : this.options.chunkSize; // this.cache.defaultChunkSize should be the same
        if (this.debug) {
            console.log(chunkSize);
        }

        /** 4 studies check **/
        let studies = params.studies;
        if (studies === undefined) {
            return;
        }

        /** 5 exclude check **/
        if (params.exclude === 'undefined') {
            params.exclude = "studies.files,studies.stats,annotation";// For sample-genotype mode less exclusive than browse mode
        }
        /** 6 check type data **/
        if (UtilsNew.isNotUndefinedOrNull(params.returnedSamples)){   //When there are samples not display histogram
            dataType = "features";
            params["histogram"]= "undefined";
            params["histogramLogarithm"] = "undefined";
            params["histogramMax"]= "undefined";
        }

        let _this = this;
        return new Promise(function(resolve, reject) {
            // Create the chunks to be retrieved
            let start = _this._getStartChunkPosition(region.start);
            let regions = [];
            do {
                regions.push(`${region.chromosome}:${start}-${start + _this.options.chunkSize - 1}`);
                start += _this.options.chunkSize;
            } while (start <= region.end);

            let p = {};
            for (let param of Object.keys(params)) {
                if (typeof params[param] !== "undefined") {
                    p[param] = params[param];
                }
            }
            let chuncksByRegion =[];

                // The query is similar to:
                // _this.client.variants().query({
                //     region: groupedRegions[i],
                //     studies: studies,
                //     //exclude: "studies, annotation"
                //     //exclude: "studies.files,studies.stats,annotation"
                // })

            for (let i = 0; i < regions.length; i++) {
                p["region"] = regions[i];
                chuncksByRegion[i] =_this.client.variants().query(p)
                    .then(function (response) {
                        return _this._variantsuccess(response, dataType, regions[i], chunkSize);
                    })
                    .catch(function (reason) {
                        reject("Server error, getting variants: " + reason);
                    });
            }

            Promise.all(chuncksByRegion).then(function (response) {
                resolve({
                    items: response, dataType: dataType, chunkSize: chunkSize, sender: _this
                });

            });


        });

    }

    _getAlignmentData(args) {
        let _this = this;
        let params = {};
//                    histogram: (dataType == 'histogram')
        Object.assign(params, this.params);
        Object.assign(params, args.params);

        /** 1 region check **/
        let region = args.region;
        if (region.start > 300000000 || region.end < 1) {
            return;
        }
        region.start = (region.start < 1) ? 1 : region.start;
        region.end = (region.end > 300000000) ? 300000000 : region.end;


        /** 2 category check **/
        let categories = this.resource.toString().split(',');   // in this adapter each category is each file

        /** 3 dataType check **/
        let dataType = args.dataType;
        if (_.isUndefined(dataType)) {
            console.log("dataType must be provided!!!");
        }

        /** 4 chunkSize check **/
        let chunkSize = params.interval ? params.interval : this.options.chunkSize; // this.cache.defaultChunkSize should be the same
        if (this.debug) {
            console.log(chunkSize);
        }

        /** 5 file check **/
        let fileId = params.fileId;
        if (fileId === undefined) {
            return;
        }

        let study = params.study;

        // Create the chunks to be retrieved
        let start = this._getStartChunkPosition(region.start);

        let regions = [];
        args.webServiceCallCount = 0;

        do {
            regions.push(`chr${region.chromosome}:${start}-${start + this.options.chunkSize - 1}`);
            start += this.options.chunkSize;
        } while(start < region.end);

        let groupedRegions = this._groupQueries(regions);
        args.regions = groupedRegions;

        return new Promise(function(resolve, reject) {
            if (dataType === "features") {
                let chunks = [];
                for (let i = 0; i < groupedRegions.length; i++) {
                    args.webServiceCallCount++;

                    let alignments = _this.client.alignments().query(fileId,
                        {
                            region: groupedRegions[i],
                            study: study
                        })
                        .then(function (response) {
                            return _this._opencgaSuccess(response, categories, dataType, chunkSize, args);
                        });


                    let coverage = _this.client.alignments().coverage(fileId,
                        {
                            region: groupedRegions[i],
                            study: study
                        })
                        .then(function (response) {
                            let aux = _this._opencgaSuccess(response, categories, dataType, chunkSize, args);
                            // We fix a little the object
                            for (let i = 0; i < aux.length; i++) {
                                aux[i].windowSize = aux[i].value[0].windowSize;
                                aux[i].value = aux[i].value[0].values;
                            }
                            return aux;
                        });

                    Promise.all([alignments, coverage]).then(function (response) {
                        args.webServiceCallCount--;
                        let auxArray = [];
                        // The array of alignments and coverage should be the same size
                        for (let i = 0; i < response[0].length; i++) {
                            if (response[0][i].chunkKey === response[1][i].chunkKey) {
                                let auxObject = {
                                    region: response[0][i].region,
                                    chunkKey: response[0][i].chunkKey,
                                    alignments: response[0][i].value,
                                    coverage: {
                                        windowSize: response[1][i].windowSize,
                                        value: response[1][i].value
                                    }
                                };
                                auxArray.push(auxObject);
                            } else {
                                console.log("Unexpected behaviour when retrieving alignments and coverage. Something went wrong.");
                                console.log("Alignment chunk key: " + response[0][i].chunkKey + ". Coverage chunk key: "
                                    + response[1][i].chunkKey);
                                reject("Unexpected behaviour when retrieving alignments and coverage. Something went wrong.");
                            }
                        }
                        chunks = chunks.concat(auxArray);

                        if (args.webServiceCallCount === 0) {
                            resolve({
                                items: chunks, dataType: dataType, chunkSize: chunkSize, sender: _this
                            });
                        }
                    })
                        .catch(function(response){
                            reject("Server alignments error");
                        });
                }
            } else { // histogram

                let chunks = [];
                for (let i = 0; i < groupedRegions.length; i++) {
                    args.webServiceCallCount++;

                    let coverage = _this.client.alignments().coverage(fileId,
                        {
                            region: groupedRegions[i],
                            study: study,
                            //windowSize: Math.round((region.end - region.start) / 500)
                        })
                        .then(function (response) {
                            let aux = _this._opencgaSuccess(response, categories, dataType, chunkSize, args);
                            let auxArray = [];
                            // Create object for renderer
                            for (let i = 0; i < aux.length; i++) {
                                let auxObject = {
                                    region: aux[i].region,
                                    chunkKey: aux[i].chunkKey,
                                    alignments: [],
                                    coverage: {
                                        windowSize: aux[i].value[0].windowSize,
                                        value: aux[i].value[0].values
                                    }
                                };
                                auxArray.push(auxObject);

                            }
                            args.webServiceCallCount--;

                            chunks = chunks.concat(auxArray);

                            if (args.webServiceCallCount === 0) {
                                resolve({
                                    items: chunks, dataType: dataType, chunkSize: chunkSize, sender: _this
                                });
                            }
                        });

                }
            }
        });
    }

    _generalOpencgaSuccess (data, dataType, chunkSize) {
        let timeId = `${Utils.randomString(4) + this.resource} save`;
        console.time(timeId);
        /** time log **/

        let regions = [];
        let chunks = [];
        for (let i = 0; i < data.response.length; i++) {    // TODO test what do several responses mean
            let queryResult = data.response[i];
            if (dataType == "histogram") {
                for (let j = 0; j < queryResult.result.length; j++) {
                    let interval = queryResult.result[j];
                    let region = new Region(interval);
                    regions.push(region);
                    chunks.push(interval);
                }
            } else {
                regions.push(new Region(queryResult.id));
                chunks.push(queryResult.result);
            }
        }

        let items = [];
        for (let i = 0; i < regions.length; i++) {
            let chunkStartId = Math.floor(regions[i].start / this.options.chunkSize);
            items.push({
                chunkKey: `${regions[i].chromosome}:${chunkStartId}_${dataType}_${chunkSize}`,
                // chunkKey: this._getChunkKey(regions[i].chromosome, chunkStartId),
                region: regions[i],
                value: chunks[i]
            });
        }

        /** time log **/
        console.timeEnd(timeId);

        return items;
    }

    _opencgaSuccess(data, categories, dataType, chunkSize, args) {
        let timeId = Utils.randomString(4) + this.resource + " save";
        console.time(timeId);
        /** time log **/
        let responseItems = [];
        for (let i = 0; i < data.response.length; i++) {
            responseItems.push({
                chunkKey: data.response[i].id,
                region: new Region(data.response[i].id),
                value: data.response[i].result
            });
        }
        console.log(data);
        /** time log **/
        console.timeEnd(timeId);

        return responseItems;
    }

    _variantsuccess(response, dataType, queryRegion, chunkSize) {

        //console.time(timeId);
        /** time log **/

        let regions = [];
        let chunks = [];
        if (dataType !== 'histogram') {
            for(let i = 0; i< response.response.length; i++){
                let res = response.response[i].result;
                chunks.push(res);

            }
            //console.log("Chunks:", chunks);
            let regionSplit = queryRegion.split(',');
            for (let i = 0; i < regionSplit.length; i++) {
                let regionStr = regionSplit[i];
                regions.push(new Region(regionStr));
            }

            let chunkStartId = Math.floor(regions[0].start / chunkSize);
            //need return a object
            return  {
                chunkKey: `${regions[0].chromosome}:${chunkStartId}_${dataType}_${chunkSize}`,
                region: regions[0],
                value: response.response[0].result,
                dataType: dataType
            };

        } else {
            let queryResult;
            if (typeof this.parseHistogram === 'function') {
                queryResult = this.parseHistogram(response);
            } else {
                queryResult = response.response[0];
            }

            for (let j = 0; j < queryResult.result.length; j++) {
                let interval = queryResult.result[j];
                let region = new Region(interval);
                regions.push(region);
                chunks.push(interval);
            }

            let items = [];
            for (let i = 0; i < regions.length; i++) {
                let chunkStartId = Math.floor(regions[i].start / this.options.chunkSize);
                items.push({
                    chunkKey: `${regions[i].chromosome}:${chunkStartId}_${dataType}_${chunkSize}`,
                    region: regions[i],
                    value: chunks[i]
                });
            }
            return items;
        }
    }

    _getStartChunkPosition (position) {
        return Math.floor(position / this.options.chunkSize) * this.options.chunkSize;
    }

    /**
     * Transform the list on a list of lists, to limit the queries
     * [ r1,r2,r3,r4,r5,r6,r7,r8 ]
     * [ [r1,r2,r3,r4], [r5,r6,r7,r8] ]
     */
    _groupQueries(uncachedRegions) {
        let groupSize = 50;
        let queriesLists = [];
        while (uncachedRegions.length > 0) {
            queriesLists.push(uncachedRegions.splice(0, groupSize).toString());
        }
        return queriesLists;
    }

}