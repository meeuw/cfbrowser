<?php
define("SFB_PATH",			"sfbrowser/");		// path of sfbrowser (relative to the page it is run from)
define("SFB_BASE",			"../data/");		// upload folder (relative to sfbpath)

define("SFB_LANG",			"nl_NL");				// the language ISO code
define("PREVIEW_BYTES",		600);				// ASCII preview ammount
define("SFB_DENY",			"php,php3,phtml");	// forbidden file extensions

define("FILETIME",			"j-n-Y H:i");		// file time display

define("SFB_ERROR_RETURN",	"<html><head><meta http-equiv=\"Refresh\" content=\"0;URL=http:/\" /></head></html>");

define("SFB_PLUGINS",		"imageresize,filetree,createascii,feather");

define("SFB_DEBUG",			!false);

define("CACHE",	SFB_DEBUG?"?".rand(0,999):"");
define("MIN",	SFB_DEBUG?"":".min");
define("T",		SFB_DEBUG?"\t":"");
define("N",		SFB_DEBUG?"\n":"");
?>