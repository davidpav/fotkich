var App = angular.module('forkitch', ['ngRoute']);

function HomeCntrl($scope,$http) {
	
	$scope.files = {};
	$scope.comments = {};

	var loadFiles = function(groupId) {
		$http.get('/api/v1/files/'+groupId).success(function(data) {
			$scope.files[groupId] = data.data;
		});	
	};

	var loadComments = function(groupId) {
		$http.get('/api/v1/comments/'+groupId).success(function(data) {
			$scope.comments[groupId] = data.data;
		});
		
	};

	$scope.addNewComment = function(groupId,commentToAdd) {
		$scope.newComment = "";
		$http.post('/api/v1/comments',{'groupId' : groupId,'comment' : commentToAdd}).success(function(data) {
			console.log('Posting comment',groupId,commentToAdd);
			loadComments(groupId);
			console.log($scope.comments[groupId]);		
		});
		

	}	

	// Loading latest medias
	$http.get('/api/v1/media').success(function(data) {
		$scope.medias = data;
		for (var i in $scope.medias.data) {
			loadFiles($scope.medias.data[i].id);
			loadComments($scope.medias.data[i].id)
		}
	});	
}


App.config(function($routeProvider) {
  $routeProvider
    .when('/', {
      controller:'HomeCntrl',
      templateUrl:'/partials/home.html'
    })
    .otherwise({
      redirectTo:'/'
    });
})
 