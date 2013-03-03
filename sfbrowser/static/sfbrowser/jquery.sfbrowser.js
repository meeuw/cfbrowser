/*!
* jQuery SFBrowser
*
* Version: 3.3.6
*
* Copyright (c) 2011 Ron Valstar http://www.sjeiti.com/
*
* Dual licensed under the MIT and GPL licenses:
*   http://www.opensource.org/licenses/mit-license.php
*   http://www.gnu.org/licenses/gpl.html
*//*
*
* description
*   - A file browsing and upload plugin. Returns a list of objects with additional information on the selected files.
*
* requires
*   - jQuery 1.2+
*   - PHP5 (or any other server side script if you care to write the connectors)
*
* features
*	- html5 upload (queued multiple uploads, upload progress, upload canceling, selection filtering, size filtering)
*   - localisation (English, Dutch or Spanish)
*	- server side script connector
*	- plugin environment (with imageresize plugin, filetree and create/edit ascii)
*	- data caching (minimal server communication)
*   - sortable file table
*   - file filtering
*   - file renameing
*   - file duplication
*   - file movement
*   - file download
*   - file path copy (CTRL-C)
*   - file/folder context menu
*   - file preview (image, audio, video, zip, text/ascii, pdf and swf)
*	- folder creation
*   - multiple files selection (not in IE for now)
*	- inline or overlay window
*	- window dragging and resizing
*	- cookie for size, position and path
*	- keyboard shortcuts
*	- key file selection
*
* how it works
*   - sfbrowser returns a list of file objects.
*	  A file object contains:
*		 - file(String):		The file including its path
*		 - mime(String):		The filetype
*		 - rsize(int):			The size in bytes
*		 - size(String):		The size formatted to B, kB, MB, GB etc..
*		 - time(int):			The time in seconds from Unix Epoch
*		 - date(String):		The time formatted in "j-n-Y H:i"
*		 - width(int):			If image, the width in px
*		 - height(int):			If image, the height in px
*
* acknowlegdements
*	- Spanish translation: Juan Razeto
*	- pdf2text by: Joeri Stegeman and Webcheatsheet.com
*
* todo:
*	- it should be possible to rename from ascii to ascii (html to htm, or maybe even jar to zip)
*	- remove pending uploads on close
*	- sort uploading files on top
*	- multiple file deletion (recursive folder deletion)
*   - new: general filetype filter
*   - new: folder information such as number of files (possibly add to filetree)
*	- oSettings.file to work with multiple files
*	o table
*		- possibly replace table for http://code.google.com/p/flexigrid/, or do it myself and fix the scrolling, structure follows function
*		- IE: fix IE and Safari scrolling (table header moves probably due to absolute positioning of parents), or simply don't do xhtml (make two tables)
*		- maybe: thumbnail view
*		o multiple file selection
*			- add: make text selection in table into multiple file selection
*			- FF: multiple file selection: disable table cell highlighting (border)
*			- IE: fix multiple file selection
*	o preview
*		- add: image preview: no-scaling on smaller images
*!		- add: word doc preview (does not seem to be possible)
*!		- add: misc archive format preview (tar, tar.gz, iso, arj, sit)
*!		- test: rar preview (implemented but errors)
*	- add: style option: new or custom css files
*	- fix: figure out IE slowness by disabling half transparent bg (replace with gif)
*   - new: add mime instead of extension (for mac)
*
* in this update:
*		- rewrote entire upload mechanism
* 		- deprecated swf multiple file upload in favor of new html5 multiple upload specification (not waiting for IE)
*		- refactored warnings
*		- tested with jQuery 1.7.0
*
* in last update:
*		- tested with jQuery 1.6.2
*		- updated to TinySort 1.1.0
*		- implemented js unit tests
*/
;(function($) {
	// private variables
	var oSettings = {};
	var aSort = [];
	var iSort = 0;
	var bHasImgs = false;
	//
	var sBase = '';
	var aPath = [];
	var oTree = {};
	//
	var bOverlay = false;
	//
	var sFolder;
	var sReturnPath;
	//
	var oConstraint;
	//
	var sBodyOverflow = "auto";
	//
	var bIsOpen = false;
	var bShortcutsDisabled = false;
	//
	// display
	var $Document = $(document);
	var $Window;
	var $Body;
	var $SFB;
	var $SFBBg;
	var $SFBWin;
	var $TableH;
	var $Table;
	var $TbBody;
	var $TrLoading;
	var $Dropbox;
	var $Context;
	//
	var $Focused;
	var $CopyPath;
	//
	var oDragTr;
	var $DragTr;
	var $DragTrTable;
	//
	var oCookie;
	//
	var oMaximized;
	//
	// regexp
	var oReg = {
		 fileNameNoExt: /(.*)[\/\\]([^\/\\]+)\.\w+$/
		,fileNameWiExt: /(.*)[\/\\]([^\/\\]+\.\w+)$/
	};
	//
	// default settings
	$.sfbrowser = {
		 id: "SFBrowser"
		,version: "3.3.7"
		,copyright: "Copyright (c) 2007 - 2011 Ron Valstar"
		,uri: "http://sfbrowser.sjeiti.com/"
		,defaults: {
			 title:		""						// the title
			,select:	function(a,params){trace(a,params)}	// calback function on choose
			,selectparams: null					// parameter object for select function
			,selectnum:	0						// number of selectable files (uint) 0==any
			,file:		""						// selected file
			,folder:	""						// subfolder (relative to base), all returned files are relative to base
			,dirs:		true					// allow visibility and creation/deletion of subdirectories
			,upload:	true					// allow upload of files
//			,swfupload:	false					// use swf uploader instead of form hack // todo: rem
			,allow:		[]						// allowed file extensions
			,resize:	null					// resize images after upload: array(width,height) or null
			,inline:	"body"					// a JQuery selector for inline browser
			,fixed:		false					// keep the browser open after selection (only works when inline is not "body")
			,cookie:	false					// use a cookie to remeber path, x, y, w, h
			,preview:	true					// enable small preview window for txt, img, video etc...
			,copyRelative:false					// CTRL-C over a selected file copies the relative or absolute file path
			,bgcolor:	"#000"					//
			,bgalpha:	.5						//
			,x:			null					// x position, centered if left null
			,y:			null					// y position, centered if left null
			,w:			640						// width
			,h:			480						// height
			// basic control (normally no need to change)
			,img:		["gif","jpg","jpeg","png"]
			,ascii:		["txt","xml","html","htm","eml","ffcmd","js","as","php","css","java","cpp","pl","log"]
			,movie:		["mp3","mp4","m4v","m4a","3gp","mov","flv","f4v"]
			,archive:	["zip","rar"]
			// set from init, explicitly setting these from js can lead to unexpected results.
			,sfbpath:	"sfbrowser/"			// path of sfbrowser (relative to the page it is run from)
			,base:		"../data/"				// upload folder (relative to sfbpath)
			,prefx:	""							// modify path to ajax script, file path and preview
			,deny:		[]						// not allowed file extensions
			,previewbytes:600					// amount of bytes for ascii preview
			,connector:	"php"					// connector file type (php)
			,lang:		{}						// language object
			,plugins:	[]						// plugins
			,maxsize:	2097152					// upload_max_filesize in bytes
			,debug:		false					// debug (allows trace to console)
		}
		// add language on the fly
		,addLang: function(oLang) {
			for (var sId in oLang) $.sfbrowser.defaults.lang[sId] = oLang[sId];
		}
/*		// swf upload functions (ExternalInterface) 446
		,swfInit: function() {trace("swfInit");}
		,ufileSelected: function(s) {
			trace("ufileSelected: ",s); // TRACE ### ufileSelected
			var bPrcd = true;
			if (getPath().contents[s]!==undefined&&!confirm(gettext("fileExistsOverwrite"))) bPrcd = false;
			if (bPrcd) $("#swfUploader").get(0).doUpload(s);
			else $("#swfUploader").get(0).cancelUpload(s);
		}
		,ufileTooBig: function(s) {
			alert(gettext("fileTooBig").replace("#1",s).replace("#2",formatSize(oSettings.maxsize,0)));
		}
		,ufileOpen: function(s) {
			trace("ufileOpen: ",s); // TRACE ### ufileOpen
			var oExists = getPath().contents[s];
			if (oExists) oExists.tr.remove(); // $$ overwriting existing files and canceling while uploading will cause the old file to disappear from view
			listAdd({file:s,mime:"upload",rsize:0,size:"",time:0,date:"",width:0,height:0}).addClass("uploading");
		}
		,ufileProgress: function(f,s) {
			var oExists = getPath().contents[s];
			var mPrg = oExists.tr.find(".progress");
			var sPerc = Math.round(f*100)+"%";
			mPrg.find("span").text(sPerc);
			mPrg.find("div").css({width:sPerc});
		}
		,ufileCompleteD: function(o) {
			trace("ufileCompleteD: ",o); // TRACE ### o
			getPath().contents[o.data.file].tr.remove();
			listAdd(o.data,1).trigger('click');
		}
		,getPath: function() {
			trace("getPath"); // TRACE ### o
			$("#swfUploader").get(0).setPath(aPath.join(""));
		}*/
	};
	// init
	$(function() {
		log(''+$.fn.sfbrowser);
	});
	// call
	$.fn.extend({
		sfbrowser: function(_settings) {
			$.extend(oSettings, $.sfbrowser.defaults, _settings);
			oSettings.connbase = "connectors/"+oSettings.connector+"/sfbrowser."+oSettings.connector;
			oSettings.conn = oSettings.prefx+oSettings.sfbpath+oSettings.connbase;
			//
			var aBase = String(window.location).split('/');
			aBase.pop();
			sBase = aBase.join('/')+'/';
			//
			trace("oSettings.conn: ",oSettings,this); // TRACE ### oSettings.conn
			//
			// extra vars in debug mode
			if (oSettings.debug) {
				$.sfbrowser.tree = oTree;
				$.sfbrowser.path = aPath;
			}
			//
			// basic vars
			$Window = $(window);
			$Body = $("body");
			//
			// set constraints
			oConstraint = {
				 mnx: 0
				,mny: 0
				,mxx: $Window.width()  - oSettings.w
				,mxy: $Window.height() - oSettings.h
				,mnw: 244
				,mnh: 275
				,mxw: $Window.width()
				,mxh: $Window.height()
			};
			//
			// try cookie for vars
			getSfbCookie();
			//
			//////////////////////////// (clear) start vars
			aSort = [];
			bHasImgs = oSettings.allow.length===0||unique(copy(oSettings.img).concat(oSettings.allow)).length<(oSettings.allow.length+oSettings.img.length);
			aPath = [];
			sFolder = oSettings.base+oSettings.folder;
			bOverlay = oSettings.inline=="body";
			if (bOverlay) oSettings.fixed = false;
			//
			// path vs cookie (we'll not use the cookie path if it is not within the parsed path)
			if (oCookie&&oCookie.path&&oCookie.path.length>0) {
				if (sFolder==oCookie.path[0]) {
					aPath = oCookie.path;
					sFolder = aPath.pop();
				}
			}
			//
			// fix path and base to relative
			var aFxSfbpath =	oSettings.sfbpath.split("/");
			var aFxBase =		oSettings.base.split("/");
			var iFxLen = Math.min(aFxBase.length,aFxSfbpath.length);
			var iDel = 0;
			for (var i=0;i<iFxLen;i++) {
				var sFxFolder = aFxBase[i];
				if (sFxFolder==".."&&aFxSfbpath.length>0) {
					while (true) {
						var sRem = aFxSfbpath.pop();
						if (sRem!="") {
							iDel++;
							break;
						}
					}
				} else if (sFxFolder!="") {
					aFxBase = aFxBase.splice(iDel,1);
					break;
				}
			}
			sReturnPath = (aFxSfbpath.join("/")+"//"+aFxBase.join("/")).replace(/(\/+)/,"/").replace(/(^\/+)/,"");
			//
			//
			//
			//////////////////////////// file browser
			trace('oSettings.browser:',oSettings.browser); // TRACE ### oSettings.browser
			$SFB =		$(oSettings.browser);
			$SFBBg =	$SFB.find("#fbbg");
			$SFBWin =	$SFB.find("#fbwin:first");
			$TableH =	$SFBWin.find("#fbtable");
			$Table =	$TableH.find("table");
			$TbBody =	$Table.find("tbody");
			$Dropbox =	$TableH.find(">div#dropbox");
			$Context =	$SFB.find("#sfbcontext");
			//
			setupDropBox();
			// sfb classes
			if ($.browser.msie) $SFB.addClass('msie');
			if (oSettings.debug) $SFB.addClass('debug');
			// top menu
			$SFB.find("div.sfbheader>h3").html((oSettings.title==""?gettext("sfb"):oSettings.title)+'<span class="version">'+$.sfbrowser.version+'</span><span class="jquery">jQuery '+$().jquery+'</span><span class="debug">debug mode</span>');
			$SFB.find("div#loadbar>span").text(gettext("loading"));
			$SFB.find("#fileToUpload").change(fileManualUpload);
			var $TopA = $SFB.find("ul#sfbtopmenu>li>a");
			if (oSettings.dirs)		$TopA.filter(".newfolder").click(addFolder).attr("title",gettext("newfolder")).find("span").text(gettext("newfolder"));
			else					$TopA.filter(".newfolder").parent().remove();
			if (oSettings.upload)	$TopA.filter(".upload").attr("title",gettext("upload")).find("span").text(gettext("upload"));
			else					$TopA.filter(".upload").parent().remove();
			if (!oSettings.fixed)	$TopA.filter(".cancelfb").click(closeSFB).attr("title",gettext("cancel")).find("span").text(gettext("cancel"));
			else					$TopA.filter(".cancelfb").parent().remove();
			if (!oSettings.fixed)	$TopA.filter(".maximizefb").click(maximizeSFB).attr("title",gettext("maximize")||'').find("span").text(gettext("maximize")||'');
			else					$TopA.filter(".maximizefb").parent().remove();
			// table headers
			var $Th = $SFB.find("table#filesDetails>thead>tr>th");
			$Th.eq(0).text(gettext("name"));
			$Th.eq(1).text(gettext("type"));
			$Th.eq(2).text(gettext("size"));
			$Th.eq(3).text(gettext("date"));
			$Th.eq(4).text(gettext("dimensions"));
			if (!bHasImgs) $Th.eq(4).remove();
			$Th.filter(":not(:last)").each(function(i,o){
				$(o).click(function(){sortFbTable(i)});
			}).append("<span>&nbsp;</span>");
			// preview
			if (!oSettings.preview) $SFB.find("#fbpreview").remove();
			trace("oSettings.preview: ",oSettings.preview);
			// big buttons
			$SFB.find("div.choose").click(chooseFile).text(gettext("choose"));
			$SFB.find("div.cancelfb").click(closeSFB).text(gettext("cancel"));
			
			if (oSettings.debug) {
				$('<a href="#" class="clearCookie">clear cookie</a>').appendTo($SFBWin.find('div.sfbbotbut')).click(function(){
					eraseCookie($.sfbrowser.id);
					trace("cookie cleared",readCookie($.sfbrowser.id));
				}).css({marginLeft:'10px'});
			}

			$SFB.find("#sfbfooter").html('<a href="'+$.sfbrowser.uri+'">'+$.sfbrowser.id+" "+$.sfbrowser.version+" &nbsp; &nbsp; &nbsp; &nbsp; "+$.sfbrowser.copyright+'</a>');
			// loading msg
			$TrLoading = $TbBody.find("tr").clone();
			// background color
			$SFBBg.css({
				 backgroundColor: oSettings.bgcolor
				,opacity: oSettings.bgalpha
				,filter: "alpha(opacity="+(100*oSettings.bgalpha)+")"
			});
			//
			// remove any existing instances and add...
			var bSFB = $("#sfbrowser").length>0;
			if (bSFB) $("#sfbrowser").remove();
			$SFB.appendTo(oSettings.inline);
			//
			//
			// set upload width to inputFile width
			if (oSettings.upload) { //&&!oSettings.swfupload) { todo: rem
				setTimeout(function(){
					$TopA.filter(".upload").css({
						 display:"inline-block"
						,minWidth:$SFB.find("#fileToUpload").width()-20+"px"
						,textAlign:	"left"
					});
				},1);
			}
			//
			//
			// context menu :: todo: implement title different to tooltip
			addContextItem("choose",		gettext("choose"),		function(){chooseFile()});
			addContextItem("rename",		gettext("rename"),		function(){renameAddInputField()});
			addContextItem("duplicate",		gettext("duplicate"),	function(){duplicateFile()});
			addContextItem("preview",		gettext("view"),		function(){$TbBody.find("tr.selected:first a.preview").trigger("click")});
			addContextItem("filedelete",	gettext("del"),			function(){$TbBody.find("tr.selected:first a.filedelete").trigger("click")});
			$SFB.click(closeContext);
			//
			$CopyPath = $('<input type="text" />').css({position:'fixed'});
			//
			//////////////////////////// window positioning and sizing
			if (bOverlay) { // resize and move window
				$Window.bind("resize", resizeBrowser);

				$SFBWin.attr("unselectable","on").css("MozUserSelect","none").bind("selectstart.ui",function(){return false;}); // $$ what's that last string?

				$SFB.find("h3").attr("title",gettext("dragMe")).mousedown(moveWindowDown);
				$SFB.find("div#resizer").attr("title",gettext("dragMe")).mousedown(resizeWindowDown);

				if (oSettings.x==null) oSettings.x = Math.round($Window.width()/2-$SFBWin.width()/2);
				if (oSettings.y==null) oSettings.y = Math.round($Window.height()/2-$SFBWin.height()/2);
				$SFBWin.css({ top:oSettings.y, left:oSettings.x, width:oSettings.w, height:oSettings.h });
			} else { // static inline window
				trace("sfb inline");
				$SFBBg.remove();
				$SFB.find("div#resizer").remove();
				$SFB.find("div.cancelfb").remove();
				$SFB.css({position:"relative",width:"auto",heigth:"auto"});
				$SFBWin.css({position:"relative",border:"0px"});
				var mPrn = $(oSettings.inline);
				resizeWindow(0,mPrn.width(),mPrn.height());
			}
			// setupKeyboardShortcuts
			setupKeyboardShortcuts();
			//
			//////////////////////////// plugins
			var oThis = {
				// functions
				 trace:				trace
				,openDir:			openDir
				,closeSFB:			closeSFB
				,addContextItem:	addContextItem
				,fillList:			fillList
				,listAdd:			listAdd
				,upDateEntry:		upDateEntry
				,file:				file
				,getPath:			getPath
				,getFilePath:		getFilePath
				,gettext:			gettext
				,lang:				lang
				,resizeWindowDown:	resizeWindowDown
				,moveWindowDown:	moveWindowDown
				,resizeWindow:		resizeWindow
				,onError:			onError
				,sortFbTable:		sortFbTable
				,shortcutsDisabled:	shortcutsDisabled
				// variables
				,aPath:		aPath
				,bOverlay:	bOverlay
				,oSettings:	oSettings
				,oTree:		oTree
				,oReg:		oReg
				// display objects
//				,mSfb:		$SFB // todo: refactor var name in plugin
				,$Document:	$Document
				,$Window:	$Window
				,$Body:		$Body
				,$SFB:		$SFB
				,$SFBWin:	$SFBWin
				,$TableH:	$TableH
				,$Table:	$Table
				,$TbBody:	$TbBody
				,$TrLoading:$TrLoading
				,$Context:	$Context
			};
			$.each( oSettings.plugins, function(i,sPlugin) { $.sfbrowser[sPlugin](oThis) });
			//
			// swf uploader (timeout to ensure width and height are set)
			//oSettings.swfupload = true;
			/*if (oSettings.swfupload) { // todo: rem
				$("<br/>").animate({"foo":1},{"duration":1,"complete":function(){
					trace("sfb swfupload init");
					$SFB.find("#fileio").remove();
					var mAup = $SFB.find("#sfbtopmenu a.upload");
					mAup.append("<div id=\"swfUploader\"></div>");
					swfobject.embedSWF(
						 oSettings.sfbpath+"uploader.swf"
						,"swfUploader"
						,(mAup.width()+10)+"px" // +10 accounts for padding
						,mAup.height()+"px"
						,"9.0.0",""
						,{ // flashvars
							 debug:		oSettings.debug
							,maxsize:	oSettings.maxsize
							,uploadUri:	oSettings.connbase
							,action:	"swfUpload"
							,folder:	aPath.join("")
							,allow:		oSettings.allow.join("|")
							,deny:		oSettings.deny.join("|")
							,resize:	oSettings.resize
						},{menu:"false",wmode:"transparent"}
					);
				}});
			}*/
			//
//			var mUpbut = $SFB.find("form#fileio"); // todo: rem
//			var mAUpbut = $SFB.find("#sfbtopmenu a.upload"); // todo: rem
			//
			//////////////////////////// start
			openDir(sFolder);
			openSFB();
			trace("SFBrowser open (",oSettings.plugins,")",true);
		}
		/*,toString: function(){
			return '[asdf]';
		}*/
	});
	$.fn.extend($.fn.sfbrowser,{
		toString: function(){
			return '['+$.sfbrowser.id+' '+$.sfbrowser.version+']';
		}
//		,foo: function(fn){
//			log('bar',this,'baz',formatSize);
////			fn.call();
//			fn.apply(formatSize);
//		}
		,unClosure: function(){
			return !oSettings.debug?{}:{
				openSFB:openSFB
				,closeSFB:closeSFB
				,setupKeyboardShortcuts:setupKeyboardShortcuts
				,keyDown:keyDown
				,keyUp:keyUp
				,selectAll:selectAll
				,getFilePath:getFilePath
				,addCopyPath:addCopyPath
				,remCopyPath:remCopyPath
				,sortFbTable:sortFbTable
				,fillList:fillList
				,listAdd:listAdd
				,upDateEntry:upDateEntry
				,getTd:getTd
				,clickTrDown:clickTrDown
				,mouseMoveTr:mouseMoveTr
				,clearMoveTr:clearMoveTr
				,clickTrUp:clickTrUp
				,chooseFile:chooseFile
				,openContext:openContext
				,closeContext:closeContext
				,previewFile:previewFile
				,openDir:openDir
				,onError:onError
				,duplicateFile:duplicateFile
				,showFile:showFile
			};
		}
	});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////////// private functions
	//
	// open
	function openSFB() {
		$SFBBg.slideDown();
		$SFBWin.slideDown("normal",function(){
			resizeBrowser();
			resizeWindow();
			if (oSettings.cookie&&!oCookie) setSfbCookie();
		});
		if (bOverlay) {
			sBodyOverflow = $Body.css("overflow");
			$Body.css({overflow:"hidden"});
		}
		bIsOpen = true;
	}
	//
	// close
	function closeSFB() {
		trace("sfb close");
		// $$ remove all pending uploads
		if (oSettings.cookie) setSfbCookie();
		$SFB.find('#fbbg').fadeOut();
		$SFBWin.slideUp("normal",function(){$SFB.remove();});
		if (bOverlay) $Body.css({overflow:sBodyOverflow}).scrollTop($Body.scrollTop()+1);
		bIsOpen = false;
	}
	//
	// setupDropBox
	function setupDropBox() {
			var sDragEvents = 'dragenter dragleave drop';
			$Window.bind(sDragEvents,handleWindow);
			function handleWindow(e){
				switch (e.type) {
					case 'dragenter':
						$Dropbox.show();
						$Dropbox.text('Drop here...');
					break;
					case 'dragleave':
						var iCx = e.originalEvent.clientX;
						var iCy = e.originalEvent.clientY;
						if (iCx>0&&iCx<oConstraint.mxw&&iCy>0&&iCy<oConstraint.mxh) break;
					case 'drop':
						$Dropbox.hide();
						$Dropbox.text('');
					break;
				}
			}
			sDragEvents += ' dragover';
			$Dropbox.bind(sDragEvents,handleDropBox);
			function handleDropBox(e){
				e.preventDefault();
				e.stopPropagation();
				switch (e.type) {
					case 'dragenter':	$Dropbox.addClass('hover'); break;
					case 'dragleave':	$Dropbox.removeClass('hover'); break;
					case 'drop':
						$Dropbox.removeClass('hover');
						fileUpload(e.originalEvent.dataTransfer.files);
						$Dropbox.hide();
					break;
				}
			}
	}
	//
	// setupKeyboardShortcuts
	function setupKeyboardShortcuts() {
		//////////////////////////// keys
		// ESC		27		close filebrowser
		// (F1		-		help)				#impossible: F1 browser help
		// F2		113		rename
		// F4		115		edit				#unimplemented
		// (F5		-		copy)				#impossible: F5 browser reloads
		// (F6		-		move)
		// (F7		-		create directory)
		// F8		119		delete				#unimplemented
		// F9		120		properties			#unimplemented
		// (F10		-		quit)
		// F11		122							#impossible: F5 browser fullscreen
		// F12		123
		// 13		RETURN	choose file
		// 32		SPACE	select file			#unimplemented
		// SHIFT	65		multiple selection	#unimplemented
		// CTRL		17		multiple selection
		// CTRL-C	67		copy path
		// CTRL-A	65+17	select all
		// CTRL-Q	65+81	close filebrowser
		// CTRL-F	65+70	open filebrowser	$$ only after first run
		// left		37
		// up		38
		// right	39
		// down		40..
//		var bSFB = $("#sfbrowser").length>0; // todo: rem
		oSettings.keys = [];
		$Window.keydown(keyDown);
		$Window.keyup(keyUp);
	}
	// keyDown
	function keyDown(e) {
		trace("keyDown: ",e.keyCode,e); // TRACE ### e.keyCode
		oSettings.keys[e.keyCode] = true;
		//var SHIFT = oSettings.keys[16];
		var CTRL = oSettings.keys[17];
		//var ALT = oSettings.keys[18];
		//
		var iNumDown = 0;
		$.each(oSettings.keys,function(i,o){if(o)iNumDown++});
		//
		// selection by char a:65 z:90
		// $$ renameTryToPost doet rename disabelen
		//if (iNumDown==1&&!renameTryToPost()&&e.keyCode>=65&&e.keyCode<=90) {
		if (!shortcutsDisabled()&&bIsOpen&&iNumDown==1&&$TbBody.find("tr>td>input").length==0&&e.keyCode>=65&&e.keyCode<=90) {
			var sChar = ("abcdefghijklmnopqrstuvwxyz").substr(e.keyCode-65,1);
			var mSel = $TbBody.find("tr.selected:first");
			var aTbr = $TbBody.find("tr");
			var iInd = aTbr.index(mSel);
			if (iInd==-1) iInd = 0;
			var iTbr = aTbr.length;
			for (var i=1;i<iTbr;i++) {
				var mChk = $(aTbr[(i+iInd)%iTbr]);
				if (mChk.attr("id").substr(0,1).toLowerCase()==sChar) {
					mChk.mouseup(clickTrUp).mouseup();
					return false;
				}
			}
		}
		// single key functions
		switch (e.keyCode) {
			case 13: if (bIsOpen) chooseFile(); break; //$$ disable in pluginmode
		}
		if (CTRL) { // CTRL functions
			var bReturn = false;
			switch (e.keyCode) {
				case 81: if (bIsOpen) closeSFB(); break;
				case 65: if (bIsOpen) selectAll(); break;
				case 70: if (!bIsOpen&&!bSFB) $.sfb(oSettings); break;
				case 67: // c
					if (bIsOpen&&$CopyPath.parent().length===0) {
						addCopyPath();
						setTimeout(remCopyPath,10);
					}
					bReturn = true;
				break;
				default: bReturn = true;
			}
			if (bReturn===false) return false;
		}
		//if (e.keyCode==70&&oSettings.keys[17]) {
		//	if (!bSFB).length==0) $.sfb();
		//}
	}
	// keyUp
	function keyUp(e) {
		trace("keyUp: ",e.keyCode,e); // TRACE ### e.keyCode
		if (bIsOpen&&!shortcutsDisabled()&&oSettings.keys[113])	renameAddInputField();
		if (bIsOpen&&oSettings.keys[27])							closeSFB();
		if ((e.keyCode===17||e.keyCode===67)&&$CopyPath.parent().length) remCopyPath();
		oSettings.keys[e.keyCode] = false;
		return false;
	}
	// select all
	function selectAll() {
		$TbBody.find("tr").each(function(){
			var $Tr = $(this);
			if (file($Tr).mime!="folderup"&&!$Tr.hasClass("uploading")) $Tr.addClass("selected");
		});
	}
	// copyPath functions
	function getFilePath(file,relative) {
		return cleanUri((relative?'':sBase)+oSettings.prefx+oSettings.sfbpath+aPath.join("")+file.file);
	}
	function addCopyPath() {
		var $Tr = $TbBody.find("tr.selected:first");
		if ($Tr.length>0) {
			var oExists = getPath().contents[$Tr.attr('id')];
			var sFilePath = getFilePath(oExists);//cleanUri((oSettings.copyRelative?'':sBase)+oSettings.prefx+oSettings.sfbpath+aPath.join("")+oExists.file);
			//
			trace('sFilePath:',sFilePath); // TRACE ### sFilePath
			//
			$Focused = $(':focus');
			$CopyPath.prependTo($Body).css({
				left:oSettings.x+'px'
				,top:oSettings.y+'px'
			}).val(sFilePath).focus().select();
		}
	}
	function remCopyPath() {
		$CopyPath.blur().remove();
		$Focused.focus();
	}
	////////////////////////////////////////////////////////////////////////////////////////
	//
	// sortFbTable
	function sortFbTable(nr) {
		if (nr!==undefined) {
			iSort = nr;
			aSort[iSort] = aSort[iSort]=="asc"?"desc":"asc";
		} else {
			if (!aSort[iSort]) aSort[iSort] = "asc";
		}
		$TbBody.find("tr.folder").tsort("td:eq(0)[abbr]",{attr:"abbr",order:aSort[iSort]});
		$TbBody.find("tr:not(.folder)").tsort("td:eq("+iSort+")[abbr]",{attr:"abbr",order:aSort[iSort]});
		$SFB.find("thead>tr>th>span").each(function(i,o){
//			$(this).css({backgroundPosition:(i==iSort?5:-9)+"px "+(aSort[iSort]=="asc"?4:-96)+"px"})
			$Span = $(o);
			if (i==iSort)	$Span.addClass('sort');
			else			$Span.removeClass('sort');
			if (aSort[iSort]=="asc")	$Span.addClass('asc');
			else						$Span.removeClass('asc');
		});
	}
	// fill list
	function fillList(contents) {
		trace("sfb fillist ",aPath);
		$TbBody.children().remove();
		$("#fbpreview").html("");
		aSort = [];
		//
		var oCTree = getPath();
		oCTree.filled = true;
		//
		//
		if (oSettings.file!="") { // find selected file // #@@##@!$#@! bloody figure out why file not has ../ and base has!!!!!!!!!
			// make path class to ease the following:
			// find size of oSettings.sfbpath to pre-pop from oSettings.base (../) and substract that from oSettings.file
			var iSfbLn = 0;
			var aSfbP = oSettings.sfbpath.split("/");
			$.each(aSfbP,function(i,s){if(s!="")iSfbLn++});
			var sPth = "";
			$.each(aPath,function(i,sPath){sPth+=sPath+"///"});
			sPth = sPth.replace(/(\/+)/g,"/");
			var aSPth = sPth.split("/");
			var sRpth = "";
			$.each(aSPth,function(i,sPath){if(i>=iSfbLn)sRpth+=sPath+"/"});
			sRpth = sRpth.replace(/(\/+)/g,"/");
			var sSelFileName = oSettings.file.replace(sRpth,"");
			var aSeF = oSettings.file.split("/");
			var iDff = aSeF.length-aPath.length-1;
		}
		//
		$.each( contents, function(i,oFile) {
			// todo: logical operators could be better
			var bDir = (oFile.mime=="folder"||oFile.mime=="folderup");
			if ((oSettings.allow.indexOf(oFile.mime)!=-1||oSettings.allow.length===0)&&oSettings.deny.indexOf(oFile.mime)==-1||bDir) {
				if ((bDir&&oSettings.dirs)||!bDir) {
					var mTr = listAdd(oFile);
					// find selected file
					if (oSettings.file!=""&&sSelFileName==oFile.file) {
						mTr.animate({"foo":1},{ // select by timeout to prevent error
							"duration":1
							,"complete":function(){
								mTr.mouseup(clickTrUp).mouseup();
								oSettings.file = "";
							}
						});
					}
				}
			}
		});
		//
		if (aPath.length>1&&!oCTree.contents[".."]) listAdd({file:"..",mime:"folderup",rsize:0,size:"-",time:0,date:""});
//		$("#sfbrowser thead>tr>th:eq(0)").trigger("click");
		$SFBWin.find("thead>tr>th:eq(0)").trigger("click");
		//
		applyToPlugins('fillList',[contents]);
		adjustFilenameWidth();
		//
		if (oSettings.file!=""&&iDff>0) openDir(aSeF[aPath.length]);
	}
	// add item to list
	function listAdd(obj,sort) {
		getPath().contents[obj.file] = obj;
		//
		var bUpload = obj.mime=="upload";
		var bFolder = obj.mime=="folder";
		var bUFolder = obj.mime=="folderup";
		var sMime = bFolder||bUFolder?gettext("folder"):obj.mime;
		// remove previous version in case we're just updating
		$(document.getElementById(obj.file)).remove(); // using $("#.. fails due to periods in filename
		//
		var $Tr = obj.tr = $('<tr id="'+obj.file+'" class="'+(bFolder||bUFolder?"folder":"file")+'">').prependTo($TbBody);
		//
		var iHo = obj.mime.charCodeAt(0)-97;
		var iVo = obj.mime.charCodeAt(1)-97;
		switch (obj.mime) {
			case 'folder':		iHo = 26;	iVo = 2; break;
			case 'folderup':	iHo = 28;	iVo = 2; break;
			case 'odg':	iHo = 26; break;
			case 'ods':	iHo = 27; break;
			case 'odp':	iHo = 28; break;
		}
		iHo *= -16;
		iVo *= -16;
		//
		$('<td abbr="'+obj.file+'" title="'+obj.file+'" class="icon" ><span class="icon" style="background-position: '+iHo+'px '+iVo+'px;" /><span class="filename">'+obj.file+'</span></td>').appendTo($Tr);
		if (bUpload) {
			$('<td abbr="upload progress" colspan="4"><div class="progress"><div></div><span>0%</span><div></td>').appendTo($Tr);
			var $TdUpButtons = $('<td />').appendTo($Tr);
			$('<a class="sfbbutton cancel" title="'+gettext('fileUploadCancel')+'"><span>'+gettext('fileUploadCancel')+'</span></a>').appendTo($TdUpButtons).click(function(){
				$("#swfUploader").get(0).cancelUpload(obj.file);
				$Tr.remove();
			});
		} else {
			$('<td abbr="'+obj.mime+'">'+sMime+'</td>').appendTo($Tr);
			$('<td abbr="'+obj.rsize+'">'+obj.size+'</td>').appendTo($Tr);
			$('<td abbr="'+obj.time+'" title="'+obj.date+'">'+obj.date.split(' ')[0]+'</td>').appendTo($Tr);
			if (bHasImgs) {
				var bVImg = (obj.width*obj.height)>0;
				$('<td'+(bVImg?(' abbr="'+(obj.width*obj.height)+'"'):'')+'>'+(bVImg?(obj.width+'x'+obj.height+'px'):'')+'</td>').appendTo($Tr);
			}
		
			var $TdButtons = $('<td />').appendTo($Tr);
			if (!(bFolder||bUFolder||bUpload))	$('<a onclick="" class="sfbbutton preview" title="'+gettext('view')+'">&nbsp;<span>'+gettext('view')+'</span></a>').appendTo($TdButtons).click(showFile);
			if (!(bUFolder||bUpload))			$('<a onclick="" class="sfbbutton filedelete" title="'+gettext('del')+'">&nbsp;<span>'+gettext('del')+'</span></a>').appendTo($TdButtons).click(deleteFile);
				
		}
		//
		//$Tr.find("td:last").css({textAlign:"right"}); // IE fix
		$Tr.folder = bFolder||bUFolder;
		if (!bUpload) {
			$Tr.mousedown(clickTrDown).mouseover( function() {
				$Tr.addClass("over");
			}).mouseout( function() {
				$Tr.removeClass("over");
			}).dblclick(function() {
				chooseFile($(this));
			})
		}
		//
		$Tr[0].oncontextmenu = function() {
			return false;
		};
		//
		applyToPlugins('listAdd',[obj]);
		//
		// select and sort
		if (sort&&sort>0) {
			aSort[iSort] = aSort[iSort]=="asc"?"desc":"asc";
			sortFbTable(iSort);
			$Tr.mousedown().mouseup();
			$TableH.scrollTop(0);	// IE and Safari
			$TbBody.scrollTop(0); // Firefox
		}
		//
		return $Tr;
	}
	function upDateEntry(tr,data) {
		var oFile = file(tr);
		$.each(data,function(s,o){
			if (oFile[s]!==o) {
				oFile[s] = o;
				switch (s) {
					case 'time':	getTd(tr,'date').attr("abbr",data.time).text(data.date.split(' ')[0]).attr('title',data.date); break;
					case 'rsize':	getTd(tr,'size').attr("abbr",data.rsize).text(data.size); break;
					case 'width':	if (data.width&&data.width) getTd(tr,'dim').attr("abbr",data.width*data.height).text(data.width+" x "+data.height+" px"); break;
				}
			}
		});
	}
	function getTd(tr,type) {
		return tr.find('td:eq('+$TableH.find('th.'+type).index()+')');
	}
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// clickTrDown
	var bTrWasSelected = false;
	var bTrDownHasRenamed = false;
	var iTrDownT = 0;
	function clickTrDown(e) {
		var $Tr = $(e.currentTarget);
		$Tr.mouseup( clickTrUp );
		//
		iTrDownT = new Date().getTime();
		//
		if ($Tr.hasClass("uploading")) return false;
		//
		var oFile = file($Tr);
		var bUFolder = oFile.mime=="folderup";
		//var bRight = e.button==2;
		var bCTRL = oSettings.keys[17];
		var bSelected = $Tr.hasClass("selected");
		bTrWasSelected = bSelected;
		//
		// check if place is in view
		var iTrY = $Tr[0].offsetTop;
		var iTbH = $TbBody.height();
		var iTsc = $TbBody.scrollTop();
		if (iTrY<iTsc||iTrY>(iTsc+iTbH)) {
			var iAdd = iTrY-(iTsc+.5*iTbH);
			var iScr = iTsc+iAdd;
			// $TbBody.scrollTop(iScr); // number is correct, should work but doesn't, scrolls to top: so added delay
			$("<br/>").animate({"foo":1},{"duration":.1,"complete":function(){
				$TbBody.scrollTop(iScr);
			}});
		}
		//
		// close rename
		bTrDownHasRenamed = renameTryToPost()!==false;
		//
		// selection
		if (!bSelected&&!bCTRL)	{
			$TbBody.find("tr").removeClass("selected");
			if (!bUFolder) $Tr.toggleClass("selected");
		}
		//
		// selection must be in fov
		// table: Chrome, IE, Safari, Opera
		// tbody: FF
		// oSettings.file causes error for $Tr.position() when not used with timout
		var iHTbl = $TableH.height();
		var iTrTop = $Tr.position().top;
		if ($TbBody.height()>iHTbl||$TbBody.get(0).scrollHeight!=iHTbl) { // body>table
			var mScroll = jQuery.browser.mozilla?$TbBody:$TableH; // scroll table or body?
			if (iTrTop>iHTbl||iTrTop<0) {
				var iDff = iTrTop>iHTbl?(iTrTop-iHTbl):(iTrTop-2*$Tr.height());
				mScroll.scrollTop(mScroll.scrollTop()+iDff);
			}
		}
		//
		//
		// drag and drop
		oDragTr = {
			 screenX:	e.screenX	// screenX:	716
			,screenY:	e.screenY	// screenY:	191
			,pageX:		e.pageX		// pageX:	716
			,pageY:		e.pageY		// pageY:	3767
			,offsetX:	e.offsetX	// offsetX:	53
			,offsetY:	e.offsetY	// offsetY:	4
			,layerX:	e.layerX	// layerX:	53
			,layerY:	e.layerY	// layerY:	3717
			,clientX:	e.clientX	// clientX:	716
			,clientY:	e.clientY	// clientY:	106
		};
		$DragTr = $TbBody.find("tr.selected").add($Tr);
		$Document.mousemove(mouseMoveTr);
		$Document.mouseup(clearMoveTr);
	}
	// mouseMoveTr
	function mouseMoveTr(e) {
		var iDx = e.screenX-oDragTr.screenX;
		var iDy = e.screenY-oDragTr.screenY;
		var iD	= Math.sqrt(iDx*iDx+iDy*iDy);
		if ($DragTrTable===undefined&&iD>20) {
			closeContext();
			$DragTrTable = $('<table id="sfbDragSelect"></table>').appendTo($SFB);
			$DragTrTable.append($DragTr.clone());
			$DragTrTable.find("td:not(:first-child)").remove();
			$DragTrTable.width("auto");
		} else if ($DragTrTable!==undefined) {
			$DragTrTable.css({
				 position:	"absolute"
				,left:		e.clientX+"px"
				,top:		e.clientY+20+"px"
				,zIndex:	"500"
			});
		}
	}
	// clearMoveTr
	function clearMoveTr() {
		$Document.unbind('mouseup',clearMoveTr);
		$Document.unbind('mousemove',mouseMoveTr);
		if ($DragTrTable!==undefined) {
			var $Rem = $DragTrTable.remove();
			$DragTrTable = undefined;
			var $ToTr = $Body.find("tr.over");
			if ($ToTr.length>0) {
				var oToFile = file($ToTr);
				if (oToFile.mime=="folder"||oToFile.mime=="folderup") {

					var sFiles = "";
					$Rem.find("tr").each(function(i,el){
						var $Tr = $(el);
						var oFromFile = file($Tr);
						if (oFromFile.mime!="folderup"&&oFromFile!==oToFile) sFiles += (sFiles==""?"":",")+oFromFile.file
					});
					if (sFiles!="") {
						$.ajax({type:"POST", url:oSettings.conn, data:"a=moveFiles&folder="+aPath.join("")+"&file="+sFiles+"&nfolder="+oToFile.file, dataType:"json", error:onError, success:function(data, status){
							if (typeof(data.error)!="undefined") {
								if (data.error!="") {
									trace(lang(data.error));
									trace(data.data);
									alert(lang(data.error));
								} else {
									trace(lang(data.msg));
									trace(data.data);
								}
								$.each(sFiles.split(","),function(i,s){
									$TbBody.find("tr").each(function(i,el){
										var $Tr = $(el);
										var sId = $Tr.attr("id");
										if (data.data.moved.indexOf(sId)!==-1) {
											$Tr.remove();
											//
											var oCurPath = getPath();
											//
											var aNewPath = copy(aPath);
											if (data.data.newfolder=="..") aNewPath.pop();
											else aNewPath.push(data.data.newfolder+"/");
											//
											getPath(aNewPath).contents[sId] = oCurPath.contents[sId];
											delete oCurPath.contents[sId];
										}
									});
								});
							}
						}});
					}
				}
			}
		}
	}
	// clickTrUp: left- or rightclick table row
	function clickTrUp(e) {
		trace("clickTrUp\n\n"); // TRACE ### clickTrUp
		//
		var $Tr = $(this);
		$Tr.unbind("mouseup");
		//
		var iTrDownUpTime = new Date().getTime()-iTrDownT;
		//
		if ($Tr.hasClass("uploading")) return false;
		//
		var oFile = file($Tr);
		var bUFolder = oFile.mime=="folderup";
		var bCTRL = oSettings.keys[17];
		var bSelected = $Tr.hasClass("selected");
		var bRight = e.button==2;
		//
		// stop drag
		clearMoveTr();
		//
		// selection
		if (bSelected&&!bCTRL)	{
			$TbBody.find("tr").removeClass("selected");
			if (!bUFolder) $Tr.addClass("selected");
		} else if (bCTRL&&!bUFolder) {
			$Tr.toggleClass("selected");
		}
		//
		// rename
		if (!bRight&&!bTrDownHasRenamed&&!bCTRL&&!bUFolder&&bTrWasSelected&&$Tr.hasClass("selected")&&iTrDownUpTime>200) {
			renameAddInputField($Tr);
		}
		//
		// context menu
		if (bRight) openContext($Tr,e.clientX-3,e.clientY-3);
		else closeContext();
		//
		// preview image
		previewFile($Tr);
		//
		bTrWasSelected = false;
		bTrDownHasRenamed = false;
		//
		return false;
	}
	// chooseFile
	function chooseFile(el) {
		var i;
		var oFile;
		var aSelected = $TbBody.find("tr.selected");
		var aSelect = [];
		// find selected trs and possible parsed element
		//aSelected.each(function(i,o){Select.push(file(this))});
		aSelected.each(function(i,o){if (i<oSettings.selectnum||oSettings.selectnum==0) aSelect.push(file(o))});
		if (el&&el.find) aSelect.push(file(el));
		// check if selection contains directory
		for (i=0;i<aSelect.length;i++) {
			oFile = aSelect[i];
			if (oFile.mime=="folder") {
				openDir(oFile.file);
				return false;
			} else if (oFile.mime=="folderup") {
				openDir();
				return false;
			}
		}
		aSelect = unique(aSelect);
		// return clones, not the objects
		for (i=0;i<aSelect.length;i++) {
			File = aSelect[i];
			var oDupl = new Object();
			for (var p in oFile) oDupl[p] = oFile[p];
			aSelect[i] = oDupl;
		}
		// return
		if (aSelect.length==0) {
			alert(gettext("fileNotselected"));
		} else {
			if (oSettings.cookie) setSfbCookie();
			$.each(aSelect,function(i,oFile){oFile.file = sReturnPath+aPath.join("").replace(oSettings.base,"")+oFile.file;});// todo: correct path`
//			oSettings.select(aSelect,oSettings.selectparams)
//			if (bOverlay) closeSFB();
			var bSelect = oSettings.select(aSelect,oSettings.selectparams)!==false;
			if (bSelect&&bOverlay) closeSFB();
		}
	}
	//
	// context menu
	function openContext($Tr,x,y) {
		var oFile = file($Tr);
		var bFolder = oFile.mime=="folder";
		var bUFolder = oFile.mime=="folderup";
		closeContext(function(){
			$Context.css({left:x,top:y});
			// check context contents
			// folders
			var oFld = {display:bFolder||bUFolder?"none":"block"};
			$Context.find("li:has(a.preview)").css(oFld);
			$Context.find("li:has(a.duplicate)").css(oFld);
			// up folders
			var oFlu = {display:!bUFolder?"block":"none"};
			$Context.find("li:has(a.rename)").css(oFlu);
			$Context.find("li:has(a.filedelete)").css(oFlu);
			// check items created by plugins
			applyToPlugins('checkContextItem',[oFile,$Context]);
			$Context.slideDown("fast");
		});
	}
	function closeContext(fnAfter) {
		$Context.slideUp("fast",typeof(fnAfter)!="function"?function(){}:fnAfter);
	}
	//
	// preview
	function previewFile($Tr) {
		var sFuri;
		var oFile = file($Tr);
		var sFile = oFile.file;
		if ($("#fbpreview").length>0&&$("#fbpreview").attr("class")!=oFile.file) {
			$("#fbpreview").html("");
			var iWprv = $("#fbpreview").width();
			var iHprv = $("#fbpreview").height();
			if (oSettings.img.indexOf(oFile.mime)!=-1) {// preview Image
				sFuri = oSettings.prefx+oSettings.sfbpath+aPath.join("")+sFile; // $$ todo: cleanup img path
				$("<img src=\""+sFuri+"?"+Math.random()+"\" />").appendTo("#fbpreview").click(function(){$(this).parent().toggleClass("auto")});
			} else if (oSettings.ascii.indexOf(oFile.mime)!=-1||oSettings.archive.indexOf(oFile.mime)!=-1||oFile.mime=='pdf') {// preview ascii or zip
				if (oFile.preview) {
					$("#fbpreview").html(oFile.preview);
				} else {
					$("#fbpreview").html(gettext("previewText"));
					$.ajax({type:"POST", url:oSettings.conn, data:"a=read&folder="+aPath.join("")+"&file="+sFile, dataType:"json", error:onError, success:function(data, status){
						var sPrv = "";
						if (typeof(data.error)!="undefined") {
							if (data.error!="") {
								trace("sfb error: ",lang(data.error),status);
								alert(lang(data.error));
							} else if (data.data.type&&data.data.text) {
								trace(lang(data.msg));
								var sMsg = data.data.type=="ascii"?gettext("previewPart").replace("#1",oSettings.previewbytes):gettext("previewContents");
								var sData = data.data.text.replace(
									/\>/g,"&gt;"
								).replace(
									/\</g,"&lt;"
								).replace(
									/(\\r\\n|\\r|\\n)/gi,'<br/>'
								).replace(
									/\\t/gi,'&nbsp;&nbsp;&nbsp;'
								).replace(
									/\\\"/gi,'"'
								).replace(
									/\\'/gi,"'"
								).replace(
									/\\\\/gi,'\\'
								);
								oFile.preview = "<pre><div>"+sMsg+"</div>\n"+sData+"</pre>";
								sPrv = oFile.preview;
							} else {
								trace(lang(data.msg));
							}
						}
						$("#fbpreview").html(sPrv);
					}});
				}
			} else if (oFile.mime=="swf"||oFile.mime=="fla") {// preview flash
				$("#fbpreview").html("<div id=\"previewFlash\"></div>");
				swfobject.embedSWF(
					 oSettings.sfbpath+aPath.join("")+sFile
					,"previewFlash"
					,iWprv+"px"
					,iHprv+"px"
					,"9.0.0","",{},{menu:"false"}
				);
			} else if (oSettings.movie.indexOf(oFile.mime)!=-1) {// preview movie
				$("#fbpreview").html("<div id=\"previewMovie\"></div>");
				sFuri = (oFile.mime=="mp3"?"":"../")+aPath.join("")+sFile;
				swfobject.embedSWF(
					 oSettings.sfbpath+"css/splayer.swf"
					,"previewMovie"
					,iWprv+"px"
					,iHprv+"px"
					,"9.0.0"
					,""
					,{ //flashvars
						 file:		sFuri
						,width:		iWprv
						,height:	iHprv
						,gui:		"playpause,scrubbar"
						,guiOver:	true
						,colors:	'{"bg":"0xFFDEDEDE","bg1":"0xFFBBBBBB","fg":"0xFF666666","fg1":"0xFFD13A3A"}'
					},{ // params
						 menu:	"false"
					}
				);
			}
			$("#fbpreview").attr("class",$("#fbpreview").html()==""?"":oFile.file);
			return true;
		}
		return false;
	}
	//
	///////////////////////////////////////////////////////////////////////////////// actions
	//
	// open directory
	function openDir(dir) {
		trace("sfb openDir ",dir," to ",oSettings.conn);
		if (dir) dir = String(dir+"/").replace(/(\/+)/gi,"/");
		if (!dir||aPath[aPath.length-1]!=dir) {
			if (dir)	aPath.push(dir);
			else		aPath.pop();
			//
			var oCTree = getPath();
			if (oCTree.filled) { // open cached directory
				fillList(oCTree.contents);
			} else { // open directory with php callback
				$TbBody.html($TrLoading);
				trace("sfb calling fileList");
				$.ajax({type:"POST", url:oSettings.conn, data:"a=fileList&folder="+aPath.join(""), dataType:"json", error:onError, success:function(data, status){
					trace("sfb callback fileList");
					if (typeof(data.error)!="undefined") {
						if (data.error!="") {
							trace(lang(data.error),status);
							alert(lang(data.error));
						} else {
							trace(lang(data.msg));
							fillList(data.data);
						}
					}
				}});
			}
			applyToPlugins('openDir',[dir]);
		}
	}
	// ajax error callback
	function onError(req, status, err) {	trace("sfb ajax error ",req,status,err); }
	// ajax before send
	//function onBeforeSend(req) {			trace("sfb ajax req "+req); }
	// duplicate file
	function duplicateFile(el) {
		var oFile = file(el);
		var sFile = oFile.file;
		//
		trace("sfb Sending duplication request...");
		$.ajax({type:"POST", url:oSettings.conn, data:"a=duplicate&folder="+aPath.join("")+"&file="+sFile, dataType:"json", error:onError, success:function(data, status){
			if (typeof(data.error)!="undefined") {
				if (data.error!="") {
					trace(lang(data.error),status);
					alert(lang(data.error));
				} else {
					trace(lang(data.msg));
					listAdd(data.data,1).trigger('click');
				}
			}
		}});
	}
	// show
	function showFile(e) {
		var mTr = $(e.target).parent().parent();
		var oFile = file(mTr);
		//trace(oSettings.conn+"?a=download&file="+aPath.join("")+obj.file);
		window.open(oSettings.conn+"?a=download&file="+aPath.join("")+oFile.file,"_blank");
	}
	// delete
	function deleteFile(e) {
		var mTr = $(e.target).parent().parent();
		var oFile = file(mTr);
		var bFolder = oFile.mime=="folder";
		if (confirm(bFolder?gettext("confirmDeletef"):gettext("confirmDelete"))) {
			$.ajax({type:"POST", url:oSettings.conn, data:"a=delete&folder="+aPath.join("")+"&file="+oFile.file, dataType:"json", error:onError, success:function(data, status){
				if (typeof(data.error)!="undefined") {
					if (data.error!="") {
						trace(lang(data.error),status);
						alert(lang(data.error));
					} else {
						trace(lang(data.msg));
						$("#fbpreview").html("");
						//
						applyToPlugins('deleteFile',[e]);
						//
						delete getPath().contents[oFile.file];
						//
						mTr.remove();
					}
				}
			}});
		}
		e.stopPropagation();
	}
	// rename
	function renameAddInputField(tr) {
		var oFile = file(tr);
		if (oFile) {
			var $Span = oFile.tr.find("td:eq(0)>span.filename");
			$Span.html("");
			var $Input = $("<input type=\"text\" value=\""+oFile.file+"\" class=\"sfbrename\" />").appendTo($Span).click(stopEvt).dblclick(stopEvt).mousedown(stopEvt).focus();
			adjustFilenameWidth();
			// select only name, not extension
			var iStart = 0;
			var iPoint = oFile.file.indexOf(".");
			var iEnd = iPoint==-1?oFile.file.length:iPoint;
			mInput = $Input.get(0);
			if( mInput.createTextRange ) {
				var selRange = mInput.createTextRange();
				selRange.collapse(true);
				selRange.moveStart('character', iStart);
				selRange.moveEnd('character', iEnd-iStart);
				selRange.select();
			} else if( mInput.setSelectionRange ) {
				mInput.setSelectionRange(iStart, iEnd);
			} else if( mInput.selectionStart ) {
				mInput.selectionStart = iStart;
				mInput.selectionEnd = iEnd;
			}
			shortcutsDisabled(true);
		}
	}
	function renameTryToPost() { // $$ first check filename clientside (saves a post)
		var aRenamed = $TbBody.find("span.filename>input");
		if (aRenamed.length>0) {
			var mInput = $(aRenamed[0]);
			var mSp = mInput.parent();
			var mTr = mSp.parents("tr:first");
			//
			var oFile = file(mTr);
			//
			var sFile = oFile.file;
			var sNFile = mInput.val();
			if (sFile==sNFile) {
				mSp.html(sFile);
				shortcutsDisabled(false);
			} else {
				$.ajax({type:"POST", url:oSettings.conn, data:"a=rename&folder="+aPath.join("")+"&file="+sFile+"&nfile="+sNFile, dataType:"json", error:onError, success:function(data, status){
					if (typeof(data.error)!="undefined") {
						if (data.error!="") {
							trace(lang(data.error));
							alert(lang(data.error));
							mSp.html(sFile);
						} else {
							trace(lang(data.msg));
							mSp.html(sNFile);
							oFile.file = sNFile;
						}
					}
					shortcutsDisabled(false);
				}});
			}
		}
		return mTr?mTr:false;
	}
	// add folder
	function addFolder() {
		trace("sfb addFolder");
		$.ajax({type:"POST", url:oSettings.conn, data:"a=addFolder&folder="+aPath.join("")+"&foldername="+gettext("newfolder"), dataType:"json", error:onError, success:function(data, status){
			if (typeof(data.error)!="undefined") {
				if (data.error!="") {
					trace(lang(data.error));
					alert(lang(data.error));
				} else {
					trace(lang(data.msg));
					listAdd(data.data,1).trigger('click').trigger('click');
					sortFbTable(); // todo: fix scrolltop below because because of
					$SFB.find('#fbtable').scrollTop(0);	// IE and Safari
					$TbBody.scrollTop(0);		// Firefox
				}
			}
		}});
	}
	
	// fileManualUpload
	function fileManualUpload() {
		var $FileToUpload = $SFB.find("#fileToUpload");
		var sFile = $FileToUpload.val();
		if (sFile=='') return false;
		var aFiles = $FileToUpload.prop('files')||[{
			fileName: sFile
			,fileSize: null
			,lastModifiedDate: null
			,name: sFile
			,size: null
			,type: null
			,webkitRelativePath: ''
		}];
		fileUpload(aFiles);
	}

	// fileUpload
	function fileUpload(aFiles) {
		$.each(aFiles,function(i,file){
			trace('sfbupload file',file); // trace file
			// check for existing same files
			var oExists = getPath().contents[file.fileName];
			if (oExists&&!confirm(gettext("fileExistsOverwrite"))) return false; // todo: add name because we now have multiple
			// add upload tr
			var $TrUp = listAdd({file:file.fileName,mime:"upload",rsize:0,size:"",time:0,date:"",width:0,height:0}).addClass("uploading");
			// upload file
			UP.to = oSettings.conn;
			var oUpload = UP.load(file,{
				a:			'uploading'
				,folder:	aPath.join('')
				,allow:		oSettings.allow.join('|')
				,deny:		oSettings.deny.join('|')
				,resize:	oSettings.resize
				,base64:	false
			}).progress(function(bytesLoaded,bytesTotal){
				var mPrg = $TrUp.find('.progress');
				var sPerc = Math.round((bytesLoaded/bytesTotal)*100)+"%";
				mPrg.find("span").text(sPerc);
				mPrg.find("div").css({width:sPerc});
			}).done(function(response){
				// todo: handle upload complete
				$TrUp.remove();
				var oResponse = jQuery.parseJSON(response);
				if (oResponse.error!='') {
					trace("sfb error: ",lang(oResponse.error));
					alert(lang(oResponse.error));
				} else {
					if (oExists) oExists.tr.remove();
					var mTr = listAdd(oResponse.data,1);
					trace("sfb file uploaded: ",oResponse.data.file,mTr[0].nodeName,mTr.attr("id"));
				}
			}).error(function(error){
				console.log('RRR',error);
				$TrUp.remove();
			});
		});
		return false;
	}
	
	// loading
	function loading() {
		var iPrgMove = Math.ceil((new Date()).getTime()*.3)%512;
		$("#loadbar>div").css("backgroundPosition", "0px "+iPrgMove+"px");
		$("#loadbar:visible").each(function(){setTimeout(loading,20);});
	}
	//
	//
	function applyToPlugins(sFunction,aParams) {
		$.each( oSettings.plugins, function(i,sPlugin) {
			if ($.sfbrowser[sPlugin][sFunction]) $.sfbrowser[sPlugin][sFunction].apply(this,aParams);
		});
	}
	///////////////////////////////////////////////////////////////////////////////// misc methods
	//
	// get file object from tr
	function file(tr) {
		if (!tr) tr = $TbBody.find("tr.selected:first");
		return getPath().contents[$(tr).attr("id")];
	}
	// find folder in oTree
	function getPath(a) {
		if (a===undefined) a = aPath;
		var oCTree = oTree;
		$.each(a,function(i,sPath){
			if (!oCTree[sPath]) oCTree[sPath] = {contents:{},filled:false};
			oCTree = oCTree[sPath];
		});
		return oCTree;
	}
	// addContextItem
	function addContextItem(className,title,fnc,after) {
		var mCItem = $("<li><a class=\"textbutton "+className+"\" title=\""+title+"\"><span>"+title+"</span></a></li>");
		if (after===undefined)	mCItem.appendTo("ul#sfbcontext").find("a").click(fnc).click(closeContext);
		else					mCItem.insertAfter("ul#sfbcontext>li:eq("+after+")").find("a").click(fnc).click(closeContext);
		return mCItem;
	}
	// lang
	function lang(s) {
		var aStr = s.split("#");
		sReturn = gettext[aStr[0]]?gettext[aStr[0]]:s;
		if (aStr.length>1) for (var i=1;i<aStr.length;i++) sReturn = sReturn.replace("#"+i,aStr[i]);
		return sReturn;
	}
	/*// clearObject // todo: rem
	function clearObject(o) {
		for (var sProp in o) delete o[sProp];
	}
	// is numeric
	function isNum(n) {
		return (parseFloat(n)+"")==n;
	}*/
	// trace
	function log() {
		try {console.log.apply(console, arguments);} catch (e) {}
	}
	function trace() {
		if (oSettings.debug===false) return;
		try {console.log.apply(console, arguments);} catch (e) {}
	}
	// gettext
	function gettext(s) {
		return oSettings.lang[s]||s;
	}
	// stop event propagation
	function stopEvt(e) {
		e.stopPropagation();
	}
	// en- or disables the keyboard shortcuts
	function shortcutsDisabled(set) {
		if (set!==undefined&&set!==bShortcutsDisabled) bShortcutsDisabled = !!set;
		return bShortcutsDisabled;
	}
	////////////////////////////////////////////////////////////////////////////
	// resizing
	//
	// resizeBrowser
	function resizeBrowser() {
		oConstraint.mxw = $Window.width();
		oConstraint.mxh = $Window.height();
		oConstraint.mxx = oConstraint.mxw-$SFBWin.width();
		oConstraint.mxy = oConstraint.mxh-$SFBWin.height();
		if ($("#sfbrowser").length>0) {
			if (bOverlay) {
				if (oMaximized===undefined) {
					var oPos = $SFBWin.position();
					var iRbX = Math.max(Math.min( oPos.left			,oConstraint.mxx),oConstraint.mnx);
					var iRbY = Math.max(Math.min( oPos.top			,oConstraint.mxy),oConstraint.mny);
					if (iRbX!=oPos.left||iRbY!=oPos.top)				moveWindow(null,iRbX,iRbY);

					var iRbW =Math.max( Math.min( $SFBWin.width()	,oConstraint.mxw),oConstraint.mnw);
					var iRbH =Math.max( Math.min( $SFBWin.height()	,oConstraint.mxh),oConstraint.mnh);
					if (iRbW<$SFBWin.width()||iRbH<$SFBWin.height())	resizeWindow(null,iRbW,iRbH);
				} else {
					maximizeSFB(true);
				}
			}
		}
	}
	// moveWindow
	function moveWindowDown(e) {
		var iXo = e.pageX-$(e.target).offset().left;
		var iYo = e.pageY-$(e.target).offset().top;
		$("body").mousemove(function(e){
			moveWindow(e,iXo,iYo);
		});
		$("body").mouseup(unbindBody);
	}
	function moveWindow(e,xo,yo) {
		var mPrnO = $("#fbbg").offset();
		var iXps = Math.max(Math.min(	e?e.pageX-xo-mPrnO.left:xo	,oConstraint.mxx),oConstraint.mnx);
		var iYps = Math.max(Math.min(	e?e.pageY-yo-mPrnO.top:yo	,oConstraint.mxy),oConstraint.mny);
		$SFBWin.css({left:iXps+"px",top:iYps+"px"});
	}
	// resizeWindow
	function resizeWindowDown(e) {
		var iXo = e.pageX-$(e.target).offset().left;
		var iYo = e.pageY-$(e.target).offset().top;
		$("body").mousemove(function(e){
			resizeWindow(e,iXo,iYo);
		});
		$("body").mouseup(unbindBody);
		oMaximized = undefined;
	}
	function resizeWindow(e,xo,yo) {
		var oSPos = $SFB.position();
		var oWPos = $SFBWin.position();
		var iWdt = Math.max(Math.min(	e?e.pageX+xo-(oWPos.left+oSPos.left):(xo?xo:$SFBWin.width())	,oConstraint.mxw),oConstraint.mnw);
		var iHgt = Math.max(Math.min(	e?e.pageY+yo-(oWPos.top+oSPos.top):(yo?yo:$SFBWin.height())		,oConstraint.mxh),oConstraint.mnh);
		$SFBWin.css({width:iWdt+"px",height:iHgt+"px"});
		//
		var iPrvH = $SFB.find("#fbpreview").height();
		var iAddH = iPrvH+(iPrvH==null?90:105);
		$TableH.css({height:(iHgt-iAddH+$Table.find("thead").height())+"px"});
		$TbBody.css({height:(iHgt-iAddH)+"px"});
		//
		adjustFilenameWidth();
		//
		if ($Table.width()>$TableH.width()) $Table.find("tr").width($TableH.width());
		//
		applyToPlugins('resizeWindow',[iWdt,iHgt]);
	}
	function maximizeSFB(force){
		if (oMaximized===undefined||force===true) {
			oMaximized = $SFBWin.position();
			oMaximized.width = $SFBWin.width();
			oMaximized.height = $SFBWin.height();
			moveWindow(null,0,0);
			resizeWindow(null,$Window.width(),$Window.height());
		} else {
			moveWindow(null,oMaximized.left,oMaximized.top);
			resizeWindow(null,oMaximized.width,oMaximized.height);
			oMaximized = undefined;
		}
	}
	function unbindBody(e) {
		$("body").unbind("mousemove");
		$("body").unbind("mouseup");
		if (oSettings.cookie) setSfbCookie();
	}
	function adjustFilenameWidth() {
		$Filename = $TbBody.find("span.filename");
		if (!$.browser.msie) $Filename.css({maxWidth:"auto"}); // IE can't handle maxWidth... idiots
		var iOverflow = $Table.width()-$TableH.width();
		for (var i=0;i<2;i++) {
			var iWmx = $Filename.parents("td:first").width()-20-(i==0?1:0)*iOverflow;
			if (!$.browser.msie) $Filename.css({maxWidth:iWmx+"px"});
			$Filename.find("input").css({width:iWmx+"px"});
		}
	}
	//////////////////////
	//
	// getSfbCookie
	function getSfbCookie() {
		if (oSettings.cookie) {
			var sCookie = readCookie($.sfbrowser.id);
			trace("sfb get cookie: "+sCookie);
			try {
				oCookie = eval("("+sCookie+")");
				oSettings.w = Math.min(Math.max(oCookie.w,oConstraint.mnw),oConstraint.mxw);
				oSettings.h = Math.min(Math.max(oCookie.h,oConstraint.mnh),oConstraint.mxh);
				oConstraint.mxx = $Window.width()  - oSettings.w;
				oConstraint.mxy = $Window.height() - oSettings.h;
				oSettings.x = Math.min(Math.max(oCookie.x,oConstraint.mnx),oConstraint.mxx);
				oSettings.y = Math.min(Math.max(oCookie.y,oConstraint.mny),oConstraint.mxy);
			} catch (e) {
				trace("sfb cookie error: "+sCookie);
				eraseCookie($.sfbrowser.id);
			}
		} else {
			eraseCookie($.sfbrowser.id);
		}
		return !!oCookie;
	}
	// setSfbCookie
	function setSfbCookie() {
		var mBg = $("#fbbg");
		var oBPos = mBg.position();
		var oPos = $SFBWin.position();
		var sCval = "{";
		sCval += "\"path\":[\""+aPath.toString().replace(/,/g,"\",\"")+"\"]";
		if (bOverlay) {
			sCval += ",\"x\":"+(oPos.left-oBPos.left);
			sCval += ",\"y\":"+(oPos.top-oBPos.top);
			sCval += ",\"w\":"+$SFBWin.width();
			sCval += ",\"h\":"+$SFBWin.height();
		}
		sCval += "}";
		trace("sfb set cookie: "+sCval);
		createCookie($.sfbrowser.id,sCval,356);
	}
	//////////////////////
	//
	// cookie functions
	//
	function createCookie(name,value,days) {
		var expires = "";
		if (days) {
			var date = new Date();
			date.setTime(date.getTime()+(days*24*60*60*1000));
			expires = "; expires="+date.toGMTString();
		}
		document.cookie = 	name+"="+value+expires+"; path=/";
	}
	function readCookie(name) {
		var nameEQ = name + "=";
		var ca = document.cookie.split(';');
		for (var i=0,l=ca.length;i<l;i++) {
			var c = ca[i];
			while (c.charAt(0)==' ') c = c.substring(1,c.length);
			if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
		}
		return null;
	}
	function eraseCookie(name) {
		createCookie(name,"",-1);
	}
	//////////////////////
	//
	// misc
	//

	function cleanUri(path) {
		path = path.replace(/(\/+)/g,'/').replace(/^\//g,'').replace(/tp:\//g,'tp://');
		while (true) {
			var iLen = path.length;
			path = path.replace(/[\w_-]+\/\.\.\//g,'');
			if (iLen===path.length) break;
		}
		return path;
	}

	function formatSize(size,round) {
		if (!round) round = 0;
		aSize = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
		for (var i=0,l=aSize.length;size>1024&&l>i;i++) size /= 1024;
		return Math.round(size,round)+aSize[i];
	}

/*	////////////////////////////////////////////////////////////////
	//
	// here starts copied functions from http://www.phpletter.com/Demo/AjaxFileUpload-Demo/
	// - changed iframe and form creation to jQuery notation
	//
	function ajaxFileUpload(s) { // todo: deprecate
		trace("sfb ajaxFileUpload");
        // todo: introduce global settings, allowing the client to modify them for all requests, not only timeout
        s = jQuery.extend({}, jQuery.ajaxSettings, s);
		//
        var iId = new Date().getTime();
		var sFrameId = "jUploadFrame" + iId;
		var sFormId = "jUploadForm" + iId;
		var sFileId = "jUploadFile" + iId;
		//
		// create form
		var mForm = $("<form  action=\"\" method=\"POST\" name=\"" + sFormId + "\" id=\"" + sFormId + "\" enctype=\"multipart/form-data\">"
			+"<input name=\"a\" type=\"hidden\" value=\"upload\" />"
			+"<input name=\"folder\" type=\"hidden\" value=\""+aPath.join("")+"\" />"
			+"<input name=\"allow\" type=\"hidden\" value=\""+oSettings.allow.join("|")+"\" />"
			+"<input name=\"deny\" type=\"hidden\" value=\""+oSettings.deny.join("|")+"\" />"
			+"<input name=\"resize\" type=\"hidden\" value=\""+oSettings.resize+"\" /></form>").appendTo('body').css({position:"absolute",top:"-1000px",left:"-1000px"});
		$("#"+s.fileElementId).before($("#"+s.fileElementId).clone(true).val("")).attr('id', s.fileElementId).appendTo(mForm);
		//
		// create iframe
		var mIframe = $("<iframe id=\""+sFrameId+"\" name=\""+sFrameId+"\"  src=\""+(typeof(s.secureuri)=="string"?s.secureuri:"javascript:false")+"\" />").appendTo("body").css({position:"absolute",top:"-1000px",left:"-1000px"});
		var mIframeIO = mIframe[0];
		//
        // Watch for a new set of requests
        if (s.global&&!jQuery.active++) jQuery.event.trigger("ajaxStart");
        var requestDone = false;
        // Create the request object
        var xml = {};
        if (s.global) jQuery.event.trigger("ajaxSend", [xml, s]);
        // Wait for a response to come back
        var uploadCallback = function(isTimeout) {
			//var mIframeIO = document.getElementById(sFrameId); // todo: rem
            try {
				if(mIframeIO.contentWindow) {
					xml.responseText = mIframeIO.contentWindow.document.body?mIframeIO.contentWindow.document.body.innerHTML:null;
					xml.responseXML = mIframeIO.contentWindow.document.XMLDocument?mIframeIO.contentWindow.document.XMLDocument:mIframeIO.contentWindow.document;
				} else if(mIframeIO.contentDocument) {
					xml.responseText = mIframeIO.contentDocument.document.body?mIframeIO.contentDocument.document.body.innerHTML:null;
                	xml.responseXML = mIframeIO.contentDocument.document.XMLDocument?mIframeIO.contentDocument.document.XMLDocument:mIframeIO.contentDocument.document;
				}
            } catch(e) {
				jQuery.handleError(s, xml, null, e);
			}
            if (xml||isTimeout=="timeout") {
                requestDone = true;
                var status;
                try {
                    status = isTimeout != "timeout" ? "success" : "error";
                    // Make sure that the request was successful or notmodified
                    if (status!="error") {
                        // process the data (runs the xml through httpData regardless of callback)
                        var data = uploadHttpData(xml, s.dataType);
                        // If a local callback was specified, fire it and pass it the data
                        if (s.success) s.success(data, status);
                        // Fire the global callback
                        if (s.global) jQuery.event.trigger("ajaxSuccess", [xml, s]);
                    } else {
                        jQuery.handleError(s, xml, status);
					}
                } catch(e) {
                    status = "error";
                    jQuery.handleError(s, xml, status, e);
                }

                // The request was completed
                if (s.global) jQuery.event.trigger("ajaxComplete", [xml, s]);

                // Handle the global AJAX counter
                if (s.global && ! --jQuery.active) jQuery.event.trigger("ajaxStop");

                // Process result
                if (s.complete) s.complete(xml, status);

				mIframe.unbind();

                setTimeout(function() {
					try {
						mIframe.remove();
						mForm.remove();
					} catch(e) {
						jQuery.handleError(s, xml, null, e);
					}
				}, 100);

                xml = null;
            }
        };
        // Timeout checker // Check to see if the request is still happening
        if (s.timeout>0) setTimeout(function() { if (!requestDone) uploadCallback("timeout"); }, s.timeout);

        try {
			mForm.attr("action", s.url).attr("method", "POST").attr("target", sFrameId).attr("encoding", "multipart/form-data").attr("enctype", "multipart/form-data").submit();
        } catch(e) {
            jQuery.handleError(s, xml, null, e);
        }
		mIframe.load(uploadCallback);
        return {abort: function () {}};
    }
	function uploadHttpData(r, type) { // todo: deprecate
        var data = !type;
        data = type=="xml" || data?r.responseXML:r.responseText;
		//trace("sfb uploadHttpData: "+data+" "+type+" "+(data?"t":"f"));
		if (data) {
			switch (type) {
				case "script":	jQuery.globalEval(data); break; // If the type is "script", eval it in global context
				case "json":	eval("data = " + data); break; // Get the JavaScript object, if JSON is used.
				case "html":	jQuery("<div>").html(data).evalScripts(); break; // evaluate scripts within html
				default:
			}
		}
        return data;
    }*/
	// set functions
	$.sfb = $.fn.sfbrowser;
})(jQuery);

// opera jQuery(window).height() bugfix for jQuery 1.2.6 // todo: probably fixed for new version
var height_ = jQuery.fn.height;
jQuery.fn.height = function() {
    if ( this[0] == window && jQuery.browser.opera && jQuery.browser.version >= 9.50)
        return window.innerHeight;
    else return height_.apply(this,arguments);
};

// functional equivalents for these prototypes
//Array.prototype.unique=function(){var a=[],i;this.sort();for(i=0;i<this.length;i++){if(this[i]!==this[i+1]){a[a.length]=this[i];}}return a;}
function unique(b) { var a=[],i; b.sort(); for(i=0,l=b.length;i<l;i++) if(b[i]!==b[i+1]) a[a.length]=b[i]; return a; }
//if(typeof Array.prototype.copy==='undefined'){Array.prototype.copy=function(a){var a=[],i=this.length;while(i--){a[i]=(typeof this[i].copy!=='undefined')?this[i].copy():this[i];}return a;};}
function copy(b) { var a=[],i = b.length; while (i--) a[i] = b[i].constructor===Array?copy(b[i]):b[i]; return a; }
// $$ fucking IE forces prototype... oh well...
if (!Array.indexOf) Array.prototype.indexOf=function(n){for(var i=0,l=this.length;i<l;i++){if(this[i]===n){return i;}}return -1;};


if (!window.UP) {
	window.UP = function(){
		var oUp = {
			load:upload
			,pending: oUploads
			,to: 'uploader.php'
			,toString: function(){return ['UP']}
		}
		var oAp = Array.prototype;
		var oUploads = {
			 toString:	function(){return '[uploads '+oUploads.length+']';}
			,push:		function(o){oAp.push.apply(oUploads,[o])}
			,indexOf:	function(o){oAp.indexOf.apply(oUploads,[o])}
			,splice:	function(o){oAp.splice.apply(oUploads,[o])}
			,remove:	function(o){oUploads.splice(oUploads.indexOf(o))}
			,length:	0
		};
		function varsToString(vars) {
			var sReturn = '?', i = 0;
			for (var s in vars) {
				if (vars.hasOwnProperty(s)) {
					sReturn += (i!==0?'&':'')+s+'='+vars[s];
					i++;
				}
			}
			return sReturn;
		}
		function upload(file,vars) {
			var fnProgress;
			var fnDone;
			var fnError;
			var oReturn = {
				progress: function(fn){
					fnProgress = fn;
					return oReturn;
				}
				,done: function(fn){
					fnDone = fn;
					return oReturn;
				}
				,error: function(fn){
					fnError = fn;
					return oReturn;
				}
				,fileReader: null
				,xhr: null
			};
			oUploads.push(oReturn);

			var oXHR = new XMLHttpRequest();
			oXHR.onreadystatechange = function(e) {
				if (oXHR.readyState!==4) return;
				oUploads.remove(oReturn);
				if (fnDone) fnDone.apply(this,[oXHR.response]);
			};
			oReturn.xhr = oXHR;
			oXHR.open('POST', oUp.to+varsToString(vars), true);

			if (window.FileReader) { // Firefox 3.6, Chrome 6, WebKit
				function handleUploadEvent(e){
					switch (e.type) {
						case 'progress':
							if (fnProgress&&e.lengthComputable) fnProgress.apply(this,[e.loaded,e.total]);
						break;
						case 'loadend':
							var sBinary = oFileReader.result;
							var sBoundary = 'xxxxxxxxx';

							oXHR.setRequestHeader('content-type', 'multipart/form-data; boundary=' + sBoundary);
							// Firefox 3.6 provides a feature sendAsBinary ()
							if (oXHR.sendAsBinary) {
								oXHR.sendAsBinary('--' + sBoundary + "\r\n"
									+ "Content-Disposition: form-data; name='upload'; filename='" + file.name + "'\r\n"
									+ "Content-Type: application/octet-stream\r\n\r\n"
									+ sBinary + "\r\n"
									+ '--' + sBoundary + '--');
							} else { // Chrome 7 sends data but you must use the base64_decode on the PHP side
								vars.base64 = true;
								oXHR.open('POST', oUp.to+varsToString(vars), true);
								oXHR.setRequestHeader('UP-FILENAME', file.name);
								oXHR.setRequestHeader('UP-SIZE', file.size);
								oXHR.setRequestHeader('UP-TYPE', file.type);
								oXHR.send(window.btoa(sBinary));
							}
//							oUploads.remove(oReturn);
//							if (fnDone) fnDone.apply(this,[oFileReader]);
						break;
						case 'error':
							/*switch(e.target.error.code) {
								case e.target.error.NOT_FOUND_ERR:
									document.getElementById(status).innerHTML = 'File not found!';
								break;
								case e.target.error.NOT_READABLE_ERR:
									document.getElementById(status).innerHTML = 'File not readable!';
								break;
								case e.target.error.ABORT_ERR:
									document.getElementById(status).innerHTML = 'upload aborted';
								break;
								default:
									document.getElementById(status).innerHTML = 'read error';
							}*/
						coUploads.remove(oReturn);
							if (fnError) fnError.apply(this,[e.currentTarget.error]);
						break;
					}
				}
				var oFileReader = new FileReader();
				oReturn.fileReader = oFileReader;
				var aUploadEvents = ['loadend','error','progress'];
				var bFRaddEvt = oFileReader.addEventListener;
				for (i=0,iLen=aUploadEvents.length;i<iLen;i++) {
					var s = aUploadEvents[i];
					if (bFRaddEvt)	oFileReader.addEventListener(s,handleUploadEvent,false);
					else			oFileReader['on'+s] = handleUploadEvent;
				}
				oFileReader.readAsBinaryString(file);
			} else { // Safari 5 does not support FileReader
//				var oXHR = new XMLHttpRequest();
//				oReturn.xhr = oXHR;
//				oXHR.open('POST', oUp.to+varsToString(vars), true);
				oXHR.setRequestHeader('UP-FILENAME', file.name);
				oXHR.setRequestHeader('UP-SIZE', file.size);
				oXHR.setRequestHeader('UP-TYPE', file.type);
				oXHR.send(file);
//				if (fnDone) fnDone.apply(this,[null,oXHR]);
			}
			return oReturn;
		}
		return oUp;
	}();
}