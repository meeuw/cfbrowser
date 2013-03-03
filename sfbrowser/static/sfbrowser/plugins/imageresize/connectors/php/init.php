<?php
//
// IMPORTANT: This init.php file is practically redundant because everything below is already automaticly handled by de main init.php. This file is just an example for how you'd handle custom initialisation.

$sSfbImgHtml = $oSFBrowser->getBody(SFB_PATH.'plugins/imageresize/browser.html');
$sPluginPath = SFB_PATH.'plugins/imageresize/';
echo T.T.'<link rel="stylesheet" type="text/css" media="screen" href="'.$sPluginPath.'css/imageresize.css" />'.N;
echo T.T.'<script type="text/javascript" src="'.$sPluginPath.'lang/'.SFB_LANG.'.js"></script>'.N;
echo T.T.'<script type="text/javascript" src="'.$sPluginPath.'jquery.sfbrowser.imageresize'.MIN.'.js"></script>'.N;
echo T.T.'<script type="text/javascript">'.N;
echo T.T.T.'jQuery.sfbrowser.defaults.imageresize = "'.$sSfbImgHtml.'"'.N;
echo T.T.'</script>'.N;
?>