import importlib.util
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('catalog',Path(__file__).resolve().parents[1]/'import_catalog.py')
catalog=importlib.util.module_from_spec(spec);spec.loader.exec_module(catalog)

class ImportTests(unittest.TestCase):
    def test_stream_keeps_geometry_dependencies_and_filters_invalid_places(self):
        xml='''<?xml version="1.0"?><osm version="0.6" generator="leisure-test">
        <node id="1" lat="51.65" lon="39.20"><tag k="amenity" v="cafe"/><tag k="name" v="Test Cafe"/></node>
        <node id="2" lat="51.65001" lon="39.20"><tag k="amenity" v="cafe"/><tag k="name" v="Test Cafe"/></node>
        <node id="3" lat="51.65" lon="39.21"><tag k="amenity" v="cafe"/><tag k="name" v="Private"/><tag k="access" v="private"/></node>
        <node id="4" lat="51.65" lon="39.21"><tag k="amenity" v="cafe"/><tag k="name" v="Foreign"/><tag k="addr:country" v="DE"/></node>
        <node id="5" lat="51.65" lon="39.21"><tag k="amenity" v="cafe"/></node>
        <node id="6" lat="55.65" lon="39.21"><tag k="amenity" v="cafe"/><tag k="name" v="Outside"/></node>
        <node id="10" lat="51.66" lon="39.20"/><node id="11" lat="51.66" lon="39.21"/>
        <node id="12" lat="51.67" lon="39.21"/><node id="13" lat="51.67" lon="39.20"/>
        <way id="100"><nd ref="10"/><nd ref="11"/><nd ref="12"/><nd ref="13"/><nd ref="10"/>
        <tag k="leisure" v="park"/><tag k="name" v="Test Park"/></way></osm>'''
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'test.osm';path.write_text(xml)
            rows=catalog.extract(path,{'name':'Воронеж','lat':51.65,'lon':39.20})
        self.assertEqual({r['id'] for r in rows},{'osm:node:1','osm:way:100'})
        self.assertEqual({r['category'] for r in rows},{'cafe','park'})
        self.assertTrue(all(51.64<r['lat']<51.68 for r in rows))

if __name__=='__main__':unittest.main()
