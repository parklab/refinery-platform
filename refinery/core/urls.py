'''
Created on Feb 20, 2012

@author: nils
'''

from django.conf.urls.defaults import patterns, url
from django.views.generic.list import ListView
from core.models import *
from guardian.shortcuts import get_perms

urlpatterns = patterns('core.views',
    url(r'^$', 'home', name="home" ),
    url(r'^about/$', 'about', name="about" ),
    url(r'^contact/$', 'contact', name="contact" ),
    url(r'^statistics/$', 'statistics', name="statistics" ),
    url(r'^users/(?P<query>[\@\.\-\+a-z0-9]+)/$', 'user'),
        # "name" is required for use with the url tag in templates
    url(r'^users/(?P<query>[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/$', 'user', name="user"),
    url(r'^groups/(?P<query>[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/$', 'group', name="group"),
    url(r'^projects/(?P<uuid>[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/$', 'project', name="project"),
    url(r'^projects/(?P<uuid>[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/edit/$', 'project_edit', name="project_edit"),
    url(r'^projects/new/$', 'project_new', name="project_new"),
    url(r'^data_sets/(?P<uuid>[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/$', 'data_set', name="data_set"),
    url(r'^workflows/(?P<uuid>[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/$', 'workflow', name="workflow"),
    url(r'^workflow_engines/(?P<uuid>[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/$', 'workflow_engine', name="workflow_engine"),
    url(r'^projects/(?P<project_uuid>[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/analyses/$', 'analyses', name="analyses"),
    url(r'^projects/(?P<project_uuid>[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/analyses/(?P<analysis_uuid>[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/$', 'analysis', name="analysis"),
)

class DataSetList(ListView):
    def get_queryset(self):
        return get_objects_for_user(self.request.user, "core.read_dataset")

urlpatterns += patterns('',
    url(r'^data_sets/$',
        DataSetList.as_view(
            context_object_name='datasets',
            paginate_by=15,
            template_name='core/data_sets.html'
        ))              
)