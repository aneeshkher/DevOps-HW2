var esprima = require("esprima");
var options = {tokens:true, tolerant: true, loc: true, range: true };
var faker = require("faker");
var fs = require("fs");
faker.locale = "en";
var mock = require('mock-fs');
var _ = require('underscore');
var Random = require('random-js');

var fileName;

function main()
{
	var args = process.argv.slice(2);

	if( args.length == 0 )
	{
		args = ["subject.js"];
	}
	var filePath = args[0];
	fileName = filePath.split('.').shift();

	constraints(filePath);

	generateTestCases(filePath);

}

var engine = Random.engines.mt19937().autoSeed();

function createConcreteIntegerValue( greaterThan, constraintValue )
{
	if( greaterThan )
		return Random.integer(constraintValue,constraintValue+10)(engine);
	else
		return Random.integer(constraintValue-10,constraintValue)(engine);
}

function Constraint(properties)
{
	this.ident = properties.ident;
	this.expression = properties.expression;
	this.operator = properties.operator;
	this.value = properties.value;
	this.funcName = properties.funcName;
	// Supported kinds: "fileWithContent","fileExists"
	// integer, string, phoneNumber
	this.kind = properties.kind;
}

function fakeDemo()
{
	console.log( faker.phone.phoneNumber() );
	console.log( faker.phone.phoneNumberFormat() );
	console.log( faker.phone.phoneFormats() );
}

var functionConstraints =
{
}

var mockFileLibrary = 
{
	pathExists:
	{
		'some/path/dirExists': {
			"fileExists1": "",
			"fileExists2": "ABCDEFG"
		},
		'path/emptyDir': {}
	},    
	fileWithContent:
	{     
		"some/path/fileExists": {
			"emptyFile": "",
			"nonEmptyFile": "DevOps"
		}
	}
};

function checkFileParams (randomParams, fileWithContent, pathExists) {
	if (fileWithContent || pathExists) {
		for (var key in randomParams) {
			if (randomParams[key] == '\'\'') {
				return 0;
			}
		}
		return 1;
	} else {
		return 1;
	}
}

function generateTestCases(filePath)
{

	//var content = "var subject = require('./subject.js')\nvar mock = require('mock-fs');\n";
	var content = "var {0} = require('./{0}')\nvar mock = require('mock-fs');\n".format(fileName, filePath);
	for ( var funcName in functionConstraints )
	{
		var params = {};
		var paramsArray = functionConstraints[funcName].params;

		// initialize params
		for (var i =0; i < functionConstraints[funcName].params.length; i++ )
		{
			var paramName = functionConstraints[funcName].params[i];
			//params[paramName] = '\'' + faker.phone.phoneNumber()+'\'';
			params[paramName] = '\'\'';
		}
		
		// update parameter values based on known constraints.
		var constraints = functionConstraints[funcName].constraints;

		// Aneesh - Adding code for generating custom params hash
		myParams = {};
		for (var index in paramsArray) {
			var param = paramsArray[index];
			if (myParams.hasOwnProperty(param)) {
				for (var con in constraints) {
					if (constraints[con].ident == param) {
						if (myParams[param].indexOf(constraints[con].value) > -1) {
							
						} else {
							myParams[p1aram].push(constraints[con].value);
						}
					}
				}
			} else {
				myParams[param] = new Array();
				for (var con in constraints) {
					
					if (constraints[con].ident == param) {
						
						if (myParams[param].indexOf(constraints[con].value) > -1) {

						} else {
							myParams[param].push(constraints[con].value);
							
						}
					}
				}
			}
		}

		for (var param in myParams) {
			if (myParams[param].length == 0) {
				myParams[param].push('');
			}
		}

		// Handle global constraints...
		var fileWithContent = _.some(constraints, {kind: 'fileWithContent' });
		var pathExists      = _.some(constraints, {kind: 'fileExists' });	

		// Aneesh - Randomization
		var written = [];
		var writtenFS = [];
		var randomParams = params;
		var constraints = functionConstraints[funcName].constraints;
		for (var i = 0; i < (constraints.length)*10; i++) {
			var randomNumber = Math.floor(Math.random()*constraints.length);
			//console.log("Random number: ",randomNumber);
			var constr = constraints[randomNumber];
			if (constraints.length > 0) {
				var ident = constr.ident;
				if (randomParams.hasOwnProperty(ident)) {
					randomParams[ident] = constraints[randomNumber].value;
					var args = Object.keys(randomParams).map(
						function(k) {
							return randomParams[k];
						}
					).join(",");
					var test = "{0}.{1}({2})".format(fileName, funcName, args);
					if (written.indexOf(test) > -1) {
						
					} else {
						if (pathExists || fileWithContent) {
							if (writtenFS.indexOf(test) > -1) {

							} else {
								if (checkFileParams(randomParams, fileWithContent,
									pathExists) == 1) {
									content += generateMockFsTestCases(pathExists,
										fileWithContent, funcName, args);
									writtenFS.push(test);
								} else {

								}
								
							}
						} else {
							content += "{0}.{1}({2});\n".format(fileName, funcName, args );
							written.push(test);
						}
					}
				}
			}
		}

		// plug-in values for parameters
		for( var c = 0; c < constraints.length; c++ )
		{
			var constraint = constraints[c];
			if( params.hasOwnProperty( constraint.ident ) )
			{
				params[constraint.ident] = constraint.value;
			}

		}

		// Prepare function arguments.
		var keyArray = Object.keys(params);
		var args = Object.keys(params).map( function(k) {return params[k]; }).join(",");
		if( pathExists || fileWithContent )
		{
			//content += generateMockFsTestCases(pathExists,fileWithContent,funcName, args);
			//// Bonus...generate constraint variations test cases....
			//content += generateMockFsTestCases(!pathExists,fileWithContent,funcName, args);
			//content += generateMockFsTestCases(pathExists,!fileWithContent,funcName, args);
			//content += generateMockFsTestCases(!pathExists,!fileWithContent,funcName, args);
		}
		else
		{
			// Emit simple test case.
			var test = "{0}.{1}({2})".format(fileName, funcName, args);			
			if (written.indexOf(test) > -1) {

			} else {
				written.push(test);
				content += "{0}.{1}({2});\n".format(fileName, funcName, args );
			}
		}

	}

	fs.writeFileSync('test.js', content, "utf8");

}

function generateMockFsTestCases (pathExists,fileWithContent,funcName,args) 
{
	var testCase = "";
	// Build mock file system based on constraints.
	var mergedFS = {};
	if( pathExists )
	{
		for (var attrname in mockFileLibrary.pathExists) { mergedFS[attrname] = mockFileLibrary.pathExists[attrname]; }
	}
	if( fileWithContent )
	{
		for (var attrname in mockFileLibrary.fileWithContent) { mergedFS[attrname] = mockFileLibrary.fileWithContent[attrname]; }
	}

	testCase += 
	"mock(" +
		JSON.stringify(mergedFS)
		+
	");\n";

	testCase += "\t{0}.{1}({2});\n".format(fileName, funcName, args );
	testCase+="mock.restore();\n";
	return testCase;
}

function constraints(filePath)
{
   var buf = fs.readFileSync(filePath, "utf8");
	var result = esprima.parse(buf, options);

	traverse(result, function (node) 
	{
		//console.log("Node type: ", node.type);
		if (node.type === 'FunctionDeclaration') 
		{
			var funcName = functionName(node);
			console.log("Line : {0} Function: {1}".format(node.loc.start.line, funcName ));

			var params = node.params.map(function(p) {return p.name});

			functionConstraints[funcName] = {constraints:[], params: params};

			// Check for expressions using argument.
			traverse(node, function(child)
			{
				
				if( child.type === 'BinaryExpression' && child.operator == "==")
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1]);
						
						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}),
							new Constraint(
							{
								ident: child.left.name,
								value: "\"NegativeEqualEqual\"",
								funcName: funcName,
								kind: "integer",
								operator: child.operator,
								expression: expression
							}
							)
							
						);
					} else if (child.left.type == 'Identifier' && funcName == 'blackListNumber') {
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1]);
						var areaCode = child.right.value;

						console.log("BlackList: ", areaCode);
						var phoneNumber = faker.phone.phoneNumberFormat();
						var unformattedPhone = phoneNumber;
						phoneNumber = phoneNumber.replace(/^\d{3}/,areaCode);
						console.log("BlackList: ", phoneNumber);
						
						functionConstraints[funcName].constraints.push(
							new Constraint(
							{
								ident: params[0],
								value: "'{0}'".format(phoneNumber),
								funcName: funcName,
								kind: "integer",
								operator: child.operator,
								expression: expression

							}),
							new Constraint(
							{
								ident: params[0],
								value: "'{0}'".format(unformattedPhone),
								funcName: funcName,
								kind: "integer",
								operator: child.operator,
								expression: expression
							})
						);

						
					} else if (child.left.type === 'CallExpression' && params.indexOf(
						child.left.callee.object.name) > -1) {
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1]);

						console.log("Expr: ", expression);
						console.log("Right hand: ", rightHand);

						functionConstraints[funcName].constraints.push(
							new Constraint(
							{
								ident: child.left.callee.object.name,
								value: child.left.arguments[0].raw,
								funcName: funcName,
								kind: "integer",
								operator: child.operator,
								expression: expression
							}),
							new Constraint(
							{
								ident: child.left.callee.object.name,
								value: "\"NegativeCallExpression\"",
								funcName: funcName,
								kind: "integer",
								operator: child.operator,
								expression: expression
							})
						);
					}

				} else if (child.type === 'UnaryExpression' && child.operator == "!") {
					if (child.argument.type === 'Identifier' 
						&& params.indexOf(child.argument.name) > -1) {
						var expression = buf.substring(child.range[0], child.range[1]);
						functionConstraints[funcName].constraints.push(
							new Constraint(
							{
								ident: child.argument.name,
								value: true,
								funcName: funcName,
								kind: "integer",
								operator: child.operator,
								expression: expression
							}),
							new Constraint(
							{
								ident: child.argument.name,
								value: false,
								funcName: funcName,
								kind: "integer",
								operator: child.operator,
								expression: expression
							})
							
						);
					}
					if (child.argument.type === 'MemberExpression' && 
						params.indexOf(child.argument.object.name) > -1) {
						
						var placeholder = child.argument.property.name;
						var optionsTrue = "\{\"{0}\": true\}".format(placeholder);
						var optionsFalse = "\{\"{0}\": true\}".format(placeholder);

						var expression = buf.substring(child.range[0], child.range[1]);

						functionConstraints[funcName].constraints.push(
							new Constraint(
							{
								ident: child.argument.object.name,
								value: optionsTrue,
								funcName: funcName,
								kind: "integer",
								operator: child.operator,
								expression: expression
							}),
							new Constraint(
							{
								ident: child.argument.object.name,
								value: optionsFalse,
								kind: "integer",
								operator: child.operator,
								expression: expression
							})
						)

					}
				} else if (child.type === 'ForStatement') {
					if (child.init.declarations.length > 0) {
						for (var index in child.init.declarations) {
							dec = child.init.declarations[index];
							if (dec.init.hasOwnProperty("object")) {
								if (params.indexOf(dec.init.object.name) > -1) {
									var phoneNumber = faker.phone.phoneNumberFormat();
									functionConstraints[funcName].constraints.push(
										new Constraint(
										{
											ident: dec.init.object.name,
											value: "\"{0}\"".format(phoneNumber),
											funcName: funcName,
											kind: "integer",
											operator: "=",
											expression: undefined
										})
									);
								}
							}
						}
					}

					if (child.body.body.length > 0) {
						for (var index in child.body.body) {
							var body = child.body.body[index];
							var right = body.expression.right;
							if (right.type == "CallExpression") {
								if (right.callee.hasOwnProperty("object")) {
									if (params.indexOf(right.callee.object.name) > -1) {
										var expression = buf.substring(child.range[0], 
											child.range[1])
										var format = faker.phone.phoneFormats();
										functionConstraints[funcName].constraints.push(
											new Constraint(
											{
												ident: right.callee.object.name,
												value: "'{0}'".format(format),
												funcName: funcName,
												kind: "integer",
												operator: "'{0}'".format(body.expression.operator),
												expression: expression
											})
										)
									}
								}
							}
						}
					}


				} else if (child.type === 'BinaryExpression' && child.operator == "!=") {
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])
						
						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}),
							new Constraint(
							{
								ident: child.left.name,
								value: "\"NegativeNotEqual\"",
								funcName: funcName,
								kind: "integer",
								operator: child.operator,
								expression: expression
							}
							)
							
						);
						
					}
				} else if (child.type === 'BinaryExpression' && child.operator == "<") {
					if (child.left.type == 'Identifier' && params.indexOf(child.left.name) > -1) {
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1]);
						
						functionConstraints[funcName].constraints.push(
							new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand) - 1,
								funcName: funcName,
								kind: "integer",
								operator: child.operator,
								expression: expression
								
							}),
							new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand) + 1,
								funcName: funcName,
								kind: "integer",
								operator: child.operator,
								expression: expression
							})
						);
					}
				} else if (child.type === 'BinaryExpression' && child.operator == ">") {
					if (child.left.type == 'Identifier' && params.indexOf(child.left.name) > -1) {
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1]);
						var val = rightHand + 2;
						
						functionConstraints[funcName].constraints.push(
							new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand) - 1,
								funcName: funcName,
								kind: "integer",
								operator: child.operator,
								expression: expression
								
							}),
							new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand) + 1,
								funcName: funcName,
								kind: "integer",
								operator: child.operator,
								expression: expression
							})
						);
					}
				}
				

				if( child.type == "CallExpression" && 
					 child.callee.property &&
					 child.callee.property.name =="readFileSync" )
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							//var file = __filename;
							//var dir = __dirname;
							//var emptyFile = dir.concat("/emptyFile");
							//var fakeFile = dir.concat("/fakeFile");
							var file = "some/path/fileExists/nonEmptyFile";
							var emptyFile = "some/path/fileExists/emptyFile";
							var fakeFile = "some.path/fileExists/fakeFile";
							functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: params[p],
									value:  "'{0}'".format(file),
									funcName: funcName,
									kind: "fileWithContent",
									operator : child.operator,
									expression: expression
								}),
								new Constraint(
								{
									ident: params[p],
									value: "'{0}'".format(emptyFile),
									funcName: funcName,
									kind: "fileWithContent",
									operator: child.operator,
									expression: expression
								}),
								new Constraint(
								{
									ident: params[p],
									value: "'{0}'".format(fakeFile),
									funcName: funcName,
									kind: "fileWithContent",
									operator: child.operator,
									expression: expression
								})
							);
						}
					}
				}

				if( child.type == "CallExpression" &&
					 child.callee.property &&
					 child.callee.property.name =="readdirSync")
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							//var dir = __dirname;
							//var emptyDir = dir.concat("/empty");
							//var fakeDir = dir.concat("/fakeDir"); 
							var dir = "some/path/dirExists";
							var emptyDir = "path/emptyDir";
							var fakeDir = "some/path/dirExists/fakeDir";
							functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: params[p],
									value:  "'{0}'".format(dir),
									funcName: funcName,
									kind: "fileExists",
									operator : child.operator,
									expression: expression
								}),
								new Constraint(
								{
									ident: params[p],
									value: "'{0}'".format(emptyDir),
									funcName: funcName,
									kind: "fileExists",
									operator: child.operator,
									expression: expression
								}),
								new Constraint(
								{
									ident: params[p],
									value: "'{0}'".format(fakeDir),
									funcName: funcName,
									kind: "fileExists",
									operator: child.operator,
									expression: expression
								})
							);
						}
					}
				}

				if( child.type == "CallExpression" &&
					 child.callee.property &&
					 child.callee.property.name =="existsSync")
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{	
							if (p == 0) {
								var dir = "some/path/dirExists";
								var emptyDir = "path/emptyDir";
								var fakeDir = "some/path/dirExists/fakeDir";
								functionConstraints[funcName].constraints.push( 
									new Constraint(
									{
										ident: params[p],
										value:  "'{0}'".format(dir),
										funcName: funcName,
										kind: "fileExists",
										operator : child.operator,
										expression: expression
									}),
									new Constraint(
									{
										ident: params[p],
										value: "'{0}'".format(emptyDir),
										funcName: funcName,
										kind: "fileExists",
										operator: child.operator,
										expression: expression
									}),
									new Constraint(
									{
										ident: params[p],
										value: "'{0}'".format(fakeDir),
										funcName: funcName,
										kind: "fileExists",
										operator: child.operator,
										expression: expression
									})
								);
							} else {
								var file = "some/path/fileExists/nonEmptyFile";
								var emptyFile = "some/path/fileExists/emptyFile";
								var fakeFile = "some.path/fileExists/fakeFile";
								functionConstraints[funcName].constraints.push( 
									new Constraint(
									{
										ident: params[p],
										value:  "'{0}'".format(file),
										funcName: funcName,
										kind: "fileWithContent",
										operator : child.operator,
										expression: expression
									}),
									new Constraint(
									{
										ident: params[p],
										value: "'{0}'".format(emptyFile),
										funcName: funcName,
										kind: "fileWithContent",
										operator: child.operator,
										expression: expression
									}),
									new Constraint(
									{
										ident: params[p],
										value: "'{0}'".format(fakeFile),
										funcName: funcName,
										kind: "fileWithContent",
										operator: child.operator,
										expression: expression
									})
								);
							}
						}
					}
				}

			});

			console.log( functionConstraints[funcName]);
			console.log("------------------");

		}
	});
}

function traverse(object, visitor) 
{
    var key, child;

    visitor.call(null, object);
    for (key in object) {
        if (object.hasOwnProperty(key)) {
            child = object[key];
            if (typeof child === 'object' && child !== null) {
                traverse(child, visitor);
            }
        }
    }
}

function traverseWithCancel(object, visitor)
{
    var key, child;

    if( visitor.call(null, object) )
    {
	    for (key in object) {
	        if (object.hasOwnProperty(key)) {
	            child = object[key];
	            if (typeof child === 'object' && child !== null) {
	                traverseWithCancel(child, visitor);
	            }
	        }
	    }
 	 }
}

function functionName( node )
{
	if( node.id )
	{
		return node.id.name;
	}
	return "";
}


if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

main();
