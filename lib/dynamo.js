var AWS = require('aws-sdk');
var uuid = require('node-uuid');

// Init DynamoDB
AWS.config.loadFromPath('./aws.json');
var db = new AWS.DynamoDB();


var MEDIA_TABLE = 'fotkich_media';
var FILES_TABLE = 'fotkich_files';
var COMMENTS_TABLE = 'fotkich_comments';







// Create New Media
exports.createNewMediaGroup = function(name,description,createdBy,callback) {
	var newGroup = 	{
	     "TableName":MEDIA_TABLE,
	     "Item":{
	            "ID": {"S": uuid.v4() },
	            "Name":{"S": name },
	           	"Time" : {"N": (new Date().getTime()).toString()},
	            "CreatedBy": {"S": createdBy},
	            "Description": {"S":description}
	       }
	  };

	db.putItem(newGroup, function(result) 
	    {
	    	callback(newGroup);
	});		

}


exports.addFileToMediaGroup = function(groupId,url,type,callback) {
	var newFile = 	{
	     "TableName": FILES_TABLE,
	     "Item":{
	            "MediaID": {"S": groupId },
	            "ID": {"S": uuid.v4() },
	            "Url":{"S": url },
	            "Type":{"S": type }
	       }
	  };

	db.putItem(newFile, function(result) 
	    {
	    	callback(newFile);
	});		

}

exports.addCommentToMediaGroup = function(groupId,comment,commentBy,callback) {
	var newComment = 	{
	     "TableName": COMMENTS_TABLE,
	     "Item":{
	            "Media_ID": {"S": groupId },
	            "Time" : {"N": (new Date().getTime()).toString()},
	            "Comment":{"S": comment },
	            "CommentBy":{"S": commentBy },
	       }
	  };

	db.putItem(newComment, function(result) 
	    {
	    	callback(newComment);
	});		

}






exports.getMediaGroupComments = function(groupId,callback) {
     var params = {
            TableName : COMMENTS_TABLE,
            KeyConditions : 
            {
                "Media_ID":
                {
                    "AttributeValueList" : [
                    {
                        "S" : groupId
                    }
                    ],
                    "ComparisonOperator" : "EQ"
                }
            }
        }
	
	db.query(params, function(err, data) {
            if (err) {
                console.log(err);
                    } 
            else {
            	var returnData = [];
            	for (var i in data['Items']) {
            		returnData.push(
            			{
            				'time': data['Items'][i]['Time']['S'],
            				'comment': data['Items'][i]['Comment']['S'],
            				'commentBy': data['Items'][i]['CommentBy']['S']
            			} );
            	}
                callback(returnData);
            }
    });        
}

exports.getMediaGroupFiles = function(groupId,callback) {

     var params = {
            TableName : FILES_TABLE,
            ScanFilter : 
            {
                "MediaID":
                {
                    "AttributeValueList" : [
                    {
                        "S" : groupId
                    }
                    ],
                    "ComparisonOperator" : "EQ"
                }              
            }
        }        
	
	db.scan(params, function(err, data) {
            if (err) {
                console.log(err);
                    } 
            else {
            	var returnData = [];
            	for (var i in data['Items']) {
            		returnData.push(
            			{
            				'url': data['Items'][i]['Url']['S'],
            				'type': data['Items'][i]['Type']['S']
            			} );
            	}
                callback(returnData);
            }
    });        
}


exports.getMediaGroups = function(youngerThan,callback) {
     var params = {
            TableName : MEDIA_TABLE,
            ScanFilter : 
            {
                "Time":
                {
                    "AttributeValueList" : [
                    {
                        "N" : youngerThan.toString()
                    }
                    ],
                    "ComparisonOperator" : "GT"
                }              
            }
        }

     console.log(params);
	
	db.scan(params, function(err, data) {
            if (err) {
                console.log(err);
                    } 
            else {
            	var returnData = [];
            	for (var i in data['Items']) {
            		returnData.push(
            			{
            				'name': data['Items'][i]['Name']['S'],
            				'time': data['Items'][i]['Time']['N'],
            				'createdBy': data['Items'][i]['CreatedBy']['S'],
            				'description': data['Items'][i]['Description']['S'],
            				'id': data['Items'][i]['ID']['S'],

            			} );
            	}
                callback(returnData);
            }
    });        
}
