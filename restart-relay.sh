#!/bin/bash -e

if [ "$1" == "help" ]; then

echo Usage:
echo "  $0 test - run all tests, and exit"
echo "  $0      - (no args) start HttpRelayServer, and wait"
echo "  $0 web  - start HttpRelayServer and sample MetaCoin web app (downloaded into \"webpack-box\" subfolder"
exit 1

else 
	echo "use '$0 help' for usage."
fi

function onexit() {
	echo onexit
	pkill -f RelayHttpServer
}

trap onexit EXIT

dir=`dirname $0`
root=`cd $dir;pwd`

cd $root
#todo: should compile the server elsewhere.
gobin=$root/build/server/bin/
export GOPATH=$root/server/:$root/build/server
echo "Using GOPATH=" $GOPATH
# cd $gobin
./scripts/extract_abi.js
make -C server 
#todo: run if changed..
blocktime=${T=0}

pkill -f RelayHttpServer && echo kill old relayserver



sleep 2



hubaddr="0x83C5541A6c8D2dBAD642f385d8d06Ca9B6C731ee"

if [ -z "$hubaddr" ]; then
echo "FATAL: failed to detect RelayHub address"
exit 1
fi

#fund relay:
relayurl=http://localhost:8090
( sleep 1 ; ./scripts/fundrelay.js $hubaddr $relayurl 0 ) &

if [ -n "$1" ]; then

$gobin/RelayHttpServer -RelayHubAddress $hubaddr -Workdir $root/build/server &

cd $root
sleep 1


echo "Running: $cmd"
if eval $cmd
then
	echo command completed successfully
else
	exitcode=$?
	echo command failed
fi

exit $exitcode

else

$gobin/RelayHttpServer -RelayHubAddress $hubaddr -Workdir $root/build/server
	
fi

