//DotDataAdapter.prototype.getData = FeatureDataAdapter.prototype.getData;

function DotDataAdapter(dataSource, args){
	FeatureDataAdapter.prototype.constructor.call(this, dataSource, args);
	var _this = this;
	
	this.async = true;

	if (args != null){
		if(args.async != null){
			this.async = args.async;
		}
	}
	
	if(this.async){
		this.dataSource.success.addEventListener(function(sender,data){
			_this.parse(data);
			_this.onLoad.notify();
		});
		this.dataSource.fetch(this.async);
	}else{
		var data = this.dataSource.fetch(this.async);
		this.parse(data);
	}
};

DotDataAdapter.prototype.parse = function(data){
	var _this = this;
	
	var graph = {};
	var lines = data.split("{")[1].split("\n");
	for (var i = 0; i < lines.length; i++){
		var line = lines[i].replace(/^\s+|\s+$/g,"");
		if ((line != null)&&(line.length > 0)){
			if(line.indexOf("->") != -1){
				var fields = line.split("->");
				if (fields[0].substr(0,1) != "#"){
					var node = fields[0];
					if(!graph[node]){
						graph[node] = [];
					}
					for(var i=1, len=fields.length; i<len; i++){
						graph[node].push(fields[i].replace(";",""));
					}
				}
			}
		}
	}
	return graph;
};
